/**
 * WordPress REST API publisher
 * Uses WordPress Application Passwords (Basic Auth) to create posts.
 * Images are uploaded to the WP Media Library so they are self-hosted
 * on WordPress and never depend on the HumanSEO server being reachable.
 * SEO meta fields are pushed to both Yoast SEO and Rank Math simultaneously.
 */

import fs from "node:fs";
import path from "node:path";

export interface WpPublishOptions {
  siteUrl: string;
  username: string;
  appPassword: string;
  title: string;
  content: string;
  slug?: string;
  excerpt?: string;
  status?: "publish" | "draft" | "private";
  categories?: number[];
  tags?: string[];
  /** SEO plugin meta — sent to both Yoast and Rank Math */
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
}

export interface WpPublishResult {
  postId: number;
  postUrl: string;
  editUrl: string;
}

export interface WpConnectionTestResult {
  success: boolean;
  message: string;
  blogName?: string;
  wpVersion?: string;
}

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
  parent: number;
}

function basicAuthHeader(username: string, appPassword: string): string {
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** MIME type lookup for image extensions */
function imageMime(filename: string): string {
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/**
 * Upload a single image file to the WordPress Media Library.
 * Returns { url, id } on success, or null on failure.
 */
async function uploadImageToWordPress(
  base: string,
  auth: string,
  localPath: string,
  filename: string,
): Promise<{ url: string; id: number } | null> {
  try {
    const fileBuffer = fs.readFileSync(localPath);
    const res = await fetch(`${base}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": imageMime(filename),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: fileBuffer,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[WP Media] upload failed for ${filename}: HTTP ${res.status} — ${errText.slice(0, 200)}`);
      return null;
    }
    const media = await res.json() as Record<string, unknown>;
    const url = media.source_url as string;
    const id = media.id as number;
    if (!url || !id) {
      console.warn(`[WP Media] unexpected response for ${filename}:`, JSON.stringify(media).slice(0, 200));
      return null;
    }
    return { url, id };
  } catch (err) {
    console.warn(`[WP Media] upload error for ${filename}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Find every /api/images/<filename> URL in article HTML, upload each image to
 * the WordPress Media Library, and return the HTML with URLs rewritten to the
 * WordPress CDN. The first successfully uploaded image becomes the featured image.
 */
async function rewriteImageUrlsForWordPress(
  html: string,
  base: string,
  auth: string,
): Promise<{ html: string; featuredMediaId: number | null }> {
  const imgDir = path.join(process.cwd(), "public", "ai-images");
  const pattern = /\/api\/images\/([\w.-]+)/g;

  const filenames = [...new Set([...html.matchAll(pattern)].map(m => m[1]))];

  if (filenames.length === 0) {
    return { html, featuredMediaId: null };
  }

  console.log(`[WP Media] uploading ${filenames.length} image(s) to WordPress Media Library`);

  const seen = new Map<string, { url: string; id: number }>();
  let firstUploaded: string | null = null;

  for (const filename of filenames) {
    const localPath = path.join(imgDir, filename);
    if (!fs.existsSync(localPath)) {
      console.warn(`[WP Media] local file not found: ${filename}`);
      continue;
    }
    const result = await uploadImageToWordPress(base, auth, localPath, filename);
    if (result) {
      seen.set(filename, result);
      if (!firstUploaded) firstUploaded = filename;
    }
  }

  let rewritten = html;
  for (const [filename, { url }] of seen) {
    const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    rewritten = rewritten.replace(new RegExp(`/api/images/${escaped}`, "g"), url);
  }

  const featuredMediaId = firstUploaded ? seen.get(firstUploaded)!.id : null;
  return { html: rewritten, featuredMediaId };
}

/**
 * Fetch all categories from a WordPress site.
 */
export async function fetchWordPressCategories(opts: {
  siteUrl: string;
  username: string;
  appPassword: string;
}): Promise<WpCategory[]> {
  const base = normalizeUrl(opts.siteUrl);
  const auth = basicAuthHeader(opts.username, opts.appPassword);
  const all: WpCategory[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`${base}/wp-json/wp/v2/categories?per_page=100&page=${page}`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) break;
    const items = await res.json() as WpCategory[];
    if (!items.length) break;
    all.push(...items);
    if (items.length < 100) break;
    page++;
  }

  return all;
}

/**
 * Publish an article to WordPress via REST API.
 * - Uploads all local images to the WP Media Library (self-hosted)
 * - Sets featured image to the first uploaded image
 * - Pushes SEO meta to both Yoast SEO and Rank Math simultaneously
 * Returns { postId, postUrl, editUrl } on success; throws on failure.
 */
export async function publishToWordPress(opts: WpPublishOptions): Promise<WpPublishResult> {
  const base = normalizeUrl(opts.siteUrl);
  const endpoint = `${base}/wp-json/wp/v2/posts`;
  const auth = basicAuthHeader(opts.username, opts.appPassword);

  // Upload images and rewrite URLs before publishing
  const { html: rewrittenContent, featuredMediaId } = await rewriteImageUrlsForWordPress(
    opts.content,
    base,
    auth,
  );

  const body: Record<string, unknown> = {
    title: opts.title,
    content: rewrittenContent,
    status: opts.status ?? "publish",
  };

  if (opts.slug) body.slug = opts.slug;
  if (opts.excerpt) body.excerpt = opts.excerpt;
  if (opts.categories?.length) body.categories = opts.categories;
  if (featuredMediaId) body.featured_media = featuredMediaId;

  // ── SEO plugin meta (Yoast SEO + Rank Math) ───────────────────────────────
  // Both plugins register these fields as REST API compatible.
  // We set both sets so whichever plugin is active on the site gets the data.
  if (opts.metaTitle || opts.metaDescription || opts.focusKeyword) {
    const meta: Record<string, string> = {};

    // Yoast SEO fields
    if (opts.metaTitle) {
      meta["_yoast_wpseo_title"] = opts.metaTitle;
    }
    if (opts.metaDescription) {
      meta["_yoast_wpseo_metadesc"] = opts.metaDescription;
    }
    if (opts.focusKeyword) {
      meta["_yoast_wpseo_focuskw"] = opts.focusKeyword;
    }

    // Rank Math fields
    if (opts.metaTitle) {
      meta["rank_math_title"] = opts.metaTitle;
    }
    if (opts.metaDescription) {
      meta["rank_math_description"] = opts.metaDescription;
    }
    if (opts.focusKeyword) {
      meta["rank_math_focus_keyword"] = opts.focusKeyword;
    }

    body.meta = meta;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("fetch failed")) {
      throw new Error(`Cannot reach ${opts.siteUrl} — check the site URL and ensure it is publicly accessible.`);
    }
    if (msg.includes("TimeoutError") || msg.includes("timeout")) {
      throw new Error(`Request to ${opts.siteUrl} timed out. The site may be down or unreachable.`);
    }
    throw new Error(`Network error: ${msg}`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json() as Record<string, unknown>;
      detail = (errBody.message as string) || JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => "");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed (${response.status}): check your WordPress username and Application Password.`);
    }
    if (response.status === 404) {
      throw new Error(`WordPress REST API not found at ${endpoint}. Ensure the REST API is enabled and the URL is correct.`);
    }
    throw new Error(`WordPress returned ${response.status}: ${detail || response.statusText}`);
  }

  const post = await response.json() as Record<string, unknown>;
  const postId = post.id as number;
  const postUrl = (post.link as string) ?? "";
  const editUrl = `${base}/wp-admin/post.php?post=${postId}&action=edit`;

  return { postId, postUrl, editUrl };
}

/**
 * Test a WordPress connection.
 */
export async function testWordPressConnection(opts: {
  siteUrl: string;
  username: string;
  appPassword: string;
}): Promise<WpConnectionTestResult> {
  const base = normalizeUrl(opts.siteUrl);

  try {
    const apiRootRes = await fetch(`${base}/wp-json/`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!apiRootRes.ok) {
      if (apiRootRes.status === 404) {
        return { success: false, message: `WordPress REST API not found at ${base}/wp-json/. Verify the site URL and that REST API is enabled.` };
      }
      return { success: false, message: `Site returned HTTP ${apiRootRes.status}. Check the URL and credentials.` };
    }

    const apiRoot = await apiRootRes.json() as Record<string, unknown>;
    const blogName = apiRoot.name as string | undefined;
    const wpVersion = apiRoot.namespaces ? "WP REST v2" : undefined;

    const meRes = await fetch(`${base}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: basicAuthHeader(opts.username, opts.appPassword) },
      signal: AbortSignal.timeout(10_000),
    });

    if (!meRes.ok) {
      if (meRes.status === 401 || meRes.status === 403) {
        return {
          success: false,
          message: `Site reached but authentication failed (${meRes.status}). Check your username and Application Password.`,
          blogName,
        };
      }
      return { success: false, message: `Authentication check returned HTTP ${meRes.status}.`, blogName };
    }

    const me = await meRes.json() as Record<string, unknown>;
    const displayName = me.name as string | undefined;

    return {
      success: true,
      message: `Connected as "${displayName || opts.username}" on "${blogName || base}".`,
      blogName,
      wpVersion,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("fetch failed")) {
      return { success: false, message: `Cannot reach ${base}. Check the site URL and ensure it is publicly accessible.` };
    }
    if (msg.includes("TimeoutError") || msg.includes("timeout")) {
      return { success: false, message: `Connection to ${base} timed out. The site may be down or slow.` };
    }
    return { success: false, message: `Connection error: ${msg}` };
  }
}
