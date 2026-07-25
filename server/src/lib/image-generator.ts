/**
 * AI Image Generator — Dynamic Marker-Based Generation
 *
 * The Writing Agent embeds [IMAGE: description] markers in the article HTML.
 * This module:
 *   1. Extracts those markers
 *   2. Generates a DALL-E image for each one with master-level prompt engineering
 *   3. Replaces markers with <figure><img></figure> HTML
 *   4. Provides PNG → WebP conversion via sharp
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db, apiKeysTable } from "../db";
import { logger } from "./logger";

async function getActiveImageKey(): Promise<{ apiKey: string; model: string; baseUrl: string } | null> {
  const rows = await db.select().from(apiKeysTable)
    .where(and(
      eq(apiKeysTable.isDefault, true),
      inArray(apiKeysTable.purpose, ["image", "both"])
    ))
    .limit(1);

  if (rows.length > 0) {
    const row = rows[0];
    // Always use dall-e-3 for image generation — modelName on the key is for text models (gpt-4o etc.)
    // gpt-4o is NOT an image model; sending it to /images/generations causes a 400 error
    return {
      apiKey: row.keyEncrypted,
      model: "dall-e-3",
      baseUrl: row.endpointUrl?.replace(/\/$/, "") ?? "https://api.openai.com/v1",
    };
  }


  // Fallback 2: plain OPENAI_API_KEY env var
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return { apiKey: envKey, model: "dall-e-3", baseUrl: "https://api.openai.com/v1" };
  return null;
}

// ── DALL-E 3 image generation via OpenAI ──────────────────────────────────────

async function generateDalle3Image(prompt: string): Promise<{ buffer: Buffer; ext: string }> {
  const key = await getActiveImageKey();
  if (!key) throw new Error("No active image API key configured. Add one in API Manager.");

  // Use URL response format — works for all OpenAI image models (dall-e-3, gpt-image-1, etc.)
  // Avoids the "Unknown parameter: response_format" error from newer API versions
  const isSquareOnly = /gpt-image/i.test(key.model); // gpt-image-1 only supports square sizes
  const size = isSquareOnly ? "1024x1024" : "1792x1024";

  const genRes = await fetch(`${key.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key.apiKey}`,
    },
    body: JSON.stringify({
      model: key.model,
      prompt: prompt.substring(0, 4000),
      n: 1,
      size,
      quality: "standard",
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!genRes.ok) {
    const text = await genRes.text().catch(() => "");
    throw new Error(`Image API ${genRes.status}: ${text}`);
  }

  const data = await genRes.json() as { data?: { url?: string; b64_json?: string }[] };
  const item = data.data?.[0];
  if (!item) throw new Error("Image API returned no image data");

  // Handle both URL and b64_json responses
  if (item.b64_json) {
    return { buffer: Buffer.from(item.b64_json, "base64"), ext: "png" };
  }

  if (item.url) {
    const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error(`Failed to download generated image: ${imgRes.status}`);
    const arrayBuffer = await imgRes.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), ext: "png" };
  }

  throw new Error("Image API returned neither url nor b64_json");
}

// ── Image directory ────────────────────────────────────────────────────────────

function getImageDir(): string {
  return path.join(process.cwd(), "public", "ai-images");
}

export function ensureImageDir() {
  const dir = getImageDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Marker extraction ─────────────────────────────────────────────────────────

export interface ImageMarker {
  marker: string;      // full [IMAGE: ...] string
  description: string; // text inside the marker
}

/** Find every [IMAGE: ...] placeholder in article HTML */
export function extractImageMarkers(html: string): ImageMarker[] {
  const regex = /\[IMAGE:\s*([^\]]{5,})\]/gi;
  const results: ImageMarker[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    results.push({ marker: m[0], description: m[1].trim() });
  }
  return results;
}

/** Strip any remaining [IMAGE: ...] markers that failed to generate */
export function stripImageMarkers(html: string): string {
  return html.replace(/\[IMAGE:[^\]]*\]/gi, "").replace(/\n{3,}/g, "\n\n");
}

// ── Master prompt engineering ─────────────────────────────────────────────────

const STYLE_SUFFIX =
  "Professional editorial photography. Ultra-sharp focus. Clean composition. Natural or studio lighting. No text overlays, no logos, no watermarks, no people's faces shown directly. Cinematic color grading. Shot on a full-frame camera with a prime lens. 16:9 widescreen aspect ratio.";

const QUALITY =
  "Award-winning photography. Magazine-quality. Hyper-realistic. 8K resolution. Perfect exposure. Rich textures. Vibrant but natural colors.";

/**
 * Build a master-level DALL-E prompt from the content description + keyword context.
 * Enriches descriptions into detailed, visually specific prompts.
 */
function buildDallePrompt(description: string, keyword: string): string {
  const cleaned = description.trim();

  if (cleaned.length < 60) {
    return `Photorealistic scene: ${cleaned}. Professionally lit, high detail, clean background, no text. ${QUALITY} ${STYLE_SUFFIX}`;
  }

  return `${cleaned}. ${QUALITY} ${STYLE_SUFFIX}. Subject context: ${keyword}`;
}

// ── Core generation ───────────────────────────────────────────────────────────

export interface GeneratedMarkerImage {
  marker: string;
  description: string;
  filename: string;
  url: string;  // root-relative: /api/images/filename.png
  alt: string;
  caption: string;
  /** true when DALL-E generation failed; a placeholder figure is inserted instead of a real image */
  failed?: boolean;
}

/** Generate DALL-E images for all [IMAGE: ...] markers found in the article */
export async function generateImagesForMarkers(
  keyword: string,
  articleId: number,
  markers: ImageMarker[]
): Promise<GeneratedMarkerImage[]> {
  ensureImageDir();
  const results: GeneratedMarkerImage[] = [];

  for (let i = 0; i < markers.length; i++) {
    const { marker, description } = markers[i];
    const prompt = buildDallePrompt(description, keyword);

    logger.info(
      { articleId, markerIndex: i + 1, total: markers.length, prompt: prompt.substring(0, 130) },
      "Generating DALL-E image for marker"
    );

    try {
      const { buffer, ext } = await generateDalle3Image(prompt);
      const hash = crypto.randomBytes(6).toString("hex");
      const filename = `article-${articleId}-img${i + 1}-${hash}.${ext}`;
      const filepath = path.join(getImageDir(), filename);

      fs.writeFileSync(filepath, buffer);

      const altText = description.replace(/[^\w\s,.'\-]/g, "").substring(0, 120).trim();
      const caption = description.length > 90 ? description.substring(0, 87) + "..." : description;

      results.push({ marker, description, filename, url: `/api/images/${filename}`, alt: altText, caption });

      logger.info({ articleId, filename, markerIndex: i + 1 }, "DALL-E 3 image saved");
    } catch (err) {
      logger.error(
        { err, articleId, markerIndex: i + 1, desc: description.substring(0, 80) },
        "DALL-E image failed — inserting placeholder"
      );
      // Record the failure so replaceMarkersWithImages can insert a visible placeholder
      results.push({ marker, description, filename: "", url: "", alt: description, caption: description, failed: true });
    }
  }

  return results;
}

// ── Marker → HTML replacement ─────────────────────────────────────────────────

/** Replace [IMAGE: ...] markers with <figure><img></figure> HTML, or a styled placeholder for failures */
export function replaceMarkersWithImages(html: string, images: GeneratedMarkerImage[]): string {
  let result = html;

  for (const img of images) {
    const escapedMarker = img.marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let figure: string;
    if (img.failed) {
      // Insert a visible, retry-friendly placeholder so the gap is never invisible
      const safeDesc = img.description.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const displayCaption = img.caption.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      figure = `\n<figure class="article-image article-image--failed" data-image-description="${safeDesc}">\n  <div class="image-placeholder">\n    <div class="image-placeholder__icon">🖼</div>\n    <p class="image-placeholder__label">Image generation failed</p>\n    <p class="image-placeholder__hint">Use "Regenerate images" to retry this image</p>\n  </div>\n  <figcaption>${displayCaption}</figcaption>\n</figure>\n`;
    } else {
      figure = `\n<figure class="article-image">\n  <img src="${img.url}" alt="${img.alt}" loading="lazy" width="1536" height="864" />\n  <figcaption>${img.caption}</figcaption>\n</figure>\n`;
    }

    result = result.replace(new RegExp(escapedMarker, "gi"), figure);
  }

  // Strip any markers that had no entry at all (shouldn't happen, but defensive)
  return stripImageMarkers(result);
}

// ── PNG → WebP conversion ─────────────────────────────────────────────────────

export interface WebpConversionResult {
  originalFilename: string;
  webpFilename: string;
  webpUrl: string;
}

/** Convert a single PNG file to WebP. Returns null if sharp isn't available or conversion fails. */
export async function convertPngToWebp(pngFilename: string): Promise<WebpConversionResult | null> {
  try {
    // Dynamic import so the server starts even if sharp isn't installed
    const sharp = await import("sharp").then((m) => (m.default ?? m) as typeof import("sharp").default);

    const imageDir = getImageDir();
    const pngPath = path.join(imageDir, pngFilename);
    if (!fs.existsSync(pngPath)) {
      logger.warn({ pngFilename }, "PNG file not found for WebP conversion");
      return null;
    }

    const webpFilename = pngFilename.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    const webpPath = path.join(imageDir, webpFilename);

    await sharp(pngPath).webp({ quality: 82, effort: 4 }).toFile(webpPath);

    logger.info({ pngFilename, webpFilename }, "PNG → WebP conversion complete");
    return { originalFilename: pngFilename, webpFilename, webpUrl: `/api/images/${webpFilename}` };
  } catch (err) {
    logger.warn({ err, pngFilename }, "WebP conversion failed — keeping PNG");
    return null;
  }
}

/** Convert all PNG/JPG images referenced in article HTML to WebP; returns updated HTML */
export async function convertArticleImagesToWebp(html: string): Promise<string> {
  const matches = html.match(/\/api\/images\/(article-[^"'\s]+\.(?:png|jpg|jpeg))/gi) ?? [];
  const filenames = [...new Set(matches.map((m) => m.replace("/api/images/", "")))];
  if (!filenames.length) return html;

  let updated = html;
  for (const filename of filenames) {
    const result = await convertPngToWebp(filename);
    if (result) {
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      updated = updated.replace(new RegExp(`/api/images/${escaped}`, "gi"), result.webpUrl);
    }
  }
  return updated;
}

// ── HTML cleanup helpers ───────────────────────────────────────────────────────

/** Strip ALL existing image elements (for clean re-generation) */
export function stripExistingImages(html: string): string {
  return html
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<img[^>]*\/?>/gi, "")
    .replace(/\n{3,}/g, "\n\n");
}

/** Strip Table of Contents blocks GPT inserts despite being told not to */
export function stripTOC(html: string): string {
  return html
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(
      /<h[23][^>]*>\s*(?:Table of Contents|Contents|On this page)\s*<\/h[23]>\s*(<(?:ul|ol)>[\s\S]*?<\/(?:ul|ol)>)/gi,
      ""
    )
    .replace(/\n{3,}/g, "\n\n");
}
