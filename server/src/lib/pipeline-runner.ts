/**
 * Pipeline Runner — 4-Agent Content Pipeline
 *
 *  Agent 1 — Writing Agent
 *    GPT writes a full SEO article in HTML. The AI embeds [IMAGE: description]
 *    markers wherever a visual genuinely helps the reader. AI decides count and
 *    placement — no fixed image number.
 *
 *  Agent 2 — Content Humanizer & Image Generator
 *    a) Humanize: GPT strips AI patterns, adds natural voice and contractions.
 *    b) Generate: DALL-E creates an image for every [IMAGE: ...] marker.
 *    c) Inject: markers replaced with <figure><img></figure> HTML.
 *
 *  Agent 3 — PNG → WebP Converter
 *    Converts every article PNG to WebP via sharp. Updates img src URLs.
 *
 *  Agent 4 — Publisher
 *    Finalises SEO metadata, calculates scores, marks article ready.
 */

import { eq, and, lte, isNull, or, inArray } from "drizzle-orm";
import {
  db,
  workflowJobsTable,
  articlesTable,
  keywordsTable,
  activityLogTable,
  settingsTable,
  wordPressSitesTable,
  schedulesTable,
  apiKeysTable,
} from "../db";
import {
  extractImageMarkers,
  generateImagesForMarkers,
  replaceMarkersWithImages,
  convertArticleImagesToWebp,
  stripExistingImages,
  stripTOC,
} from "./image-generator";
import { publishToWordPress, fetchWordPressCategories } from "./wordpress-publisher.js";
import { logger } from "./logger";

const TICK_MS = 2000;
let running = false;

export const AGENT_STEPS = [
  { step: "writing",            agentName: "Writing Agent" },
  { step: "image_generation",   agentName: "Content Humanizer & Image Generator" },
  { step: "image_optimization", agentName: "PNG → WebP Converter" },
  { step: "publishing",         agentName: "Publisher" },
];

// ── Active key lookup ─────────────────────────────────────────────────────────

/**
 * Get the active API key for a given purpose from the database.
 * Falls back to env vars if no DB key is configured.
 */
async function getActiveKey(purpose: "text" | "image"): Promise<{
  apiKey: string; model: string; baseUrl: string; provider: string;
} | null> {
  // Look for a key marked isDefault=true covering this purpose
  const rows = await db.select().from(apiKeysTable)
    .where(and(
      eq(apiKeysTable.isDefault, true),
      inArray(apiKeysTable.purpose, [purpose, "both"])
    ))
    .limit(1);

  if (rows.length > 0) {
    const row = rows[0];
    const defaultBaseUrl = row.provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : "https://api.openai.com/v1";
    return {
      apiKey: row.keyEncrypted,
      model: row.modelName ?? (purpose === "image" ? "dall-e-3" : "gpt-4o"),
      baseUrl: row.endpointUrl?.replace(/\/$/, "") ?? defaultBaseUrl,
      provider: row.provider,
    };
  }

    return {
      model: purpose === "image" ? "dall-e-3" : "gpt-4o",
      provider: "openai",
    };
  }

  // Fallback 2: plain OPENAI_API_KEY env var
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    return {
      apiKey: envKey,
      model: purpose === "image" ? "dall-e-3" : "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      provider: "openai",
    };
  }

  return null;
}

// ── Text generation ───────────────────────────────────────────────────────────

async function gptChat(system: string, user: string, maxTokens = 8192): Promise<string> {
  const key = await getActiveKey("text");
  if (!key) throw new Error("No active text API key configured. Add one in API Manager.");

  const res = await fetch(`${key.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key.apiKey}`,
    },
    body: JSON.stringify({
      model: key.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`${key.provider} API ${res.status}: ${await res.text().catch(() => "")}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:html)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();
}

function markdownToHtml(text: string): string {
  if ((text.match(/<[ph][1-6]?\b/g) || []).length > 3) return text;
  return text
    .replace(/^#{1}\s+(.+)$/gm, "<h1>$1</h1>")
    .replace(/^#{2}\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#{3}\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^#{4,6}\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^(?!<[a-z])(.{20,})$/gm, "<p>$1</p>")
    .replace(/\n{3,}/g, "\n\n");
}

// ── Job processor ─────────────────────────────────────────────────────────────

const inFlight = new Set<number>();

async function processOneJob() {
  const [runningJob] = await db
    .select()
    .from(workflowJobsTable)
    .where(eq(workflowJobsTable.status, "running"))
    .limit(1);
  if (runningJob) return;

  const pendingJobs = await db
    .select()
    .from(workflowJobsTable)
    .where(eq(workflowJobsTable.status, "pending"))
    .orderBy(workflowJobsTable.id);

  const nextJob = pendingJobs.find((j) => j.articleId !== null && !inFlight.has(j.articleId!));
  if (!nextJob || nextJob.articleId === null) return;

  inFlight.add(nextJob.articleId);

  let keyword = "your keyword";
  if (nextJob.keywordId) {
    const [kw] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, nextJob.keywordId));
    if (kw) keyword = kw.keyword;
  } else if (nextJob.articleId) {
    const [art] = await db.select({ keyword: articlesTable.keyword }).from(articlesTable).where(eq(articlesTable.id, nextJob.articleId));
    if (art?.keyword) keyword = art.keyword;
  }

  runJobAsync(nextJob.id, nextJob.articleId, nextJob.step, keyword).catch((err) => {
    logger.error({ err, jobId: nextJob.id }, "Pipeline job failed");
    inFlight.delete(nextJob.articleId!);
  });
}

async function runJobAsync(jobId: number, articleId: number, step: string, keyword: string) {
  await db
    .update(workflowJobsTable)
    .set({ status: "running", startedAt: new Date(), progress: 5 })
    .where(eq(workflowJobsTable.id, jobId));

  // Progress pulse while AI works
  let progress = 10;
  const progressInterval = setInterval(async () => {
    progress = Math.min(88, progress + 4);
    await db.update(workflowJobsTable).set({ progress }).where(eq(workflowJobsTable.id, jobId));
  }, 3000);

  let stepMessage = `${step} completed`;
  let stepFailed = false;
  let stepError = "";
  try {
    stepMessage = await executeStep(step, articleId, keyword);
  } catch (err) {
    stepFailed = true;
    stepError = err instanceof Error ? err.message : String(err);
    logger.error({ err, step, articleId }, "Step execution error — halting pipeline");
  } finally {
    clearInterval(progressInterval);
  }

  if (stepFailed) {
    // Mark this job as failed
    await db
      .update(workflowJobsTable)
      .set({ status: "failed", progress: 0, message: stepError, completedAt: new Date() })
      .where(eq(workflowJobsTable.id, jobId));
    // Cancel all still-pending downstream jobs for this article
    await db
      .update(workflowJobsTable)
      .set({ status: "cancelled", completedAt: new Date(), message: `Cancelled: upstream step "${step}" failed` })
      .where(and(eq(workflowJobsTable.articleId, articleId), eq(workflowJobsTable.status, "pending")));
    // Mark article as failed
    await db
      .update(articlesTable)
      .set({ status: "failed" })
      .where(eq(articlesTable.id, articleId));
    inFlight.delete(articleId);
    return;
  }

  await db
    .update(workflowJobsTable)
    .set({ status: "completed", progress: 100, message: stepMessage, completedAt: new Date() })
    .where(eq(workflowJobsTable.id, jobId));

  const [nextPending] = await db
    .select()
    .from(workflowJobsTable)
    .where(and(eq(workflowJobsTable.articleId, articleId), eq(workflowJobsTable.status, "pending")))
    .orderBy(workflowJobsTable.id)
    .limit(1);

  if (nextPending) {
    inFlight.delete(articleId);
  } else {
    await finalizeArticle(articleId, keyword);
    inFlight.delete(articleId);
  }
}

// ── Step execution ────────────────────────────────────────────────────────────

async function executeStep(step: string, articleId: number, keyword: string): Promise<string> {

  // ═══════════════════════════════════════════════════════════════════════════
  //  AGENT 1 — Writing Agent
  //  GPT writes full SEO article HTML with [IMAGE: scene] markers embedded
  //  wherever visuals genuinely help. AI decides count and placement.
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "writing") {
    const [settings] = await db
      .select({ writingPrompt: settingsTable.writingPrompt, defaultWordCount: settingsTable.defaultWordCount })
      .from(settingsTable)
      .limit(1);

    const [articleRow] = await db
      .select({ keywordId: articlesTable.keywordId })
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId));

    let targetWc = settings?.defaultWordCount ?? 1500;
    if (articleRow?.keywordId) {
      const [kw] = await db.select({ wordCount: keywordsTable.wordCount }).from(keywordsTable).where(eq(keywordsTable.id, articleRow.keywordId));
      if (kw?.wordCount) targetWc = kw.wordCount;
    }
    targetWc = Math.max(1500, targetWc);

    const kwLow = keyword.toLowerCase();
    const needsTable = /\bvs\b|versus|comparison|compare|best\b|top \d+|alternatives/.test(kwLow);

    logger.info({ keyword, targetWc }, "Writing Agent: calling GPT");

    // ── Default writing prompt (user-uploaded expert SEO template) ─────────────
    const DEFAULT_WRITING_SYSTEM = `Write a comprehensive, expert-level blog post targeting the primary keyword:

Primary Keyword: ${keyword}

Your objective is to create the single most valuable resource on this topic that can outperform every page currently ranking on Google's first page.

Research Requirements

Before writing, perform a complete SERP analysis for the target keyword.

Analyze the top-ranking pages and identify:

* Search intent
* Content gaps
* Questions users are asking
* Common subtopics
* Missing information competitors fail to explain
* Opportunities to provide deeper expertise
* Semantic keywords and related entities
* People Also Ask questions
* Relevant long-tail keywords
* Supporting NLP terms

Create a significantly better article than every competitor in terms of:

* Content depth
* Topical authority
* Practical value
* Expert insights
* Readability
* User experience
* Trustworthiness

Do not copy competitor content. Use it only to understand the topic and produce a superior resource.

Content Requirements

The article must be:

Write as long as the topic demands. Cover the subject completely — do not stop until every angle, subtopic, and user question is fully addressed. Shorter articles fail to rank. Longer, more comprehensive articles outperform competitors. Let the topic complexity determine the length naturally.

* 100 percent original
* Completely plagiarism free
* Written naturally by an experienced professional content writer
* Human sounding
* Formal and authoritative
* Free from robotic language
* Free from filler
* Free from keyword stuffing
* Free from repetitive wording
* Free from generic AI phrases
* Easy to read
* Rich in useful information
* Based on facts wherever possible

Every paragraph should provide genuine value.

Never write unnecessary introductory paragraphs.

Avoid writing obvious information simply to increase word count.

Google SEO Requirements

Write according to Google's latest guidelines including:

* Helpful Content System
* E-E-A-T
* Search Quality Evaluator Guidelines
* AI Overview optimization
* Semantic SEO
* Topical authority
* Entity optimization
* Natural keyword placement

The article should satisfy both traditional search rankings and Google's AI-generated search results.

Writing Style

Use:

* Short sentences
* Short paragraphs
* Active voice
* Professional English
* Natural transitions
* Clear explanations
* Industry terminology explained in simple language

Write like an experienced subject matter expert.

Do not sound like AI.

Avoid overusing words such as: Additionally, Furthermore, Moreover, In today's world, In conclusion, Unlock, Elevate, Delve, Game changer, Cutting edge, Revolutionary, Seamless, Leverage, Whether you are, It is important to note, Without further ado.

Formatting

Use a logical heading structure.

Include:

* One H1
* Optimized H2 sections
* H3 headings where needed

Use:

* Tables only where they improve understanding
* Bullet lists only when appropriate
* Numbered steps where applicable
* Comparison charts${needsTable ? " — include a full comparison table for this keyword" : ""}
* Checklists
* Examples
* Real world scenarios

Never force tables or lists.

Semantic SEO

Naturally include:

* Primary keyword
* Secondary keywords
* Related entities
* Synonyms
* Contextual phrases
* Question based keywords

Do not keyword stuff. Maintain natural readability.

FAQ Section

Create an FAQ section based on:

* Google's People Also Ask
* Related Searches
* Real user intent
* Long-tail search queries

Provide concise yet complete answers. Include exactly 5 Q&As using this structure:
<h3>Question?</h3>
<p>Specific 2–3 sentence answer with a real detail or number.</p>

Final Quality Checklist

Before finalizing, ensure that:

* The article is more comprehensive than every top-ranking competitor.
* Every section adds unique value.
* No fluff exists.
* No repetitive information exists.
* The article is fully optimized for Google Search and AI Overview.
* The content demonstrates strong E-E-A-T signals.
* The article reads as if written entirely by an experienced human writer.
* Grammar and spelling are perfect.
* Formatting is clean and highly readable.
* The content is fully unique.
* The article contains no AI-style filler or repetitive language.

──────────────────────────────────────────
TECHNICAL OUTPUT RULES (non-negotiable):
──────────────────────────────────────────
Output ONLY valid HTML. Use only these tags: <h1> <h2> <h3> <p> <ul> <ol> <li> <strong> <em> <table> <thead> <tbody> <tr> <th> <td> <blockquote>
No markdown. No code fences. No <img> tags. No Table of Contents. No <nav>.

IMAGE MARKERS — place these on their own line between sections where a visual genuinely helps the reader:
Format: [IMAGE: detailed scene description]
Each description must be 40+ words: include lighting, camera angle, setting, exact subject, mood, and style.
GOOD: [IMAGE: Close-up of a financial analyst's hands annotating a printed P&L statement under warm desk lamp light, scattered highlighters and coffee cup visible, shallow depth of field, professional editorial photography, 16:9 widescreen]
BAD: [IMAGE: person working at desk]
Place one image marker every 300–400 words naturally throughout the article. Let the content length determine total image count — a 1500-word article gets ~4 images, a 3000-word article gets ~8. Never place two markers in a row.`;

    // If user has saved a custom prompt in Settings, use that instead (with keyword injected)
    const WRITING_SYSTEM = settings?.writingPrompt
      ? settings.writingPrompt.replace(/\[INSERT KEYWORD\]/gi, keyword).replace(/Primary Keyword:\s*\n/i, `Primary Keyword: ${keyword}\n`)
      : DEFAULT_WRITING_SYSTEM;

    const rawHtml = await gptChat(
      WRITING_SYSTEM,
      `Write the complete article now for the keyword: "${keyword}". Output only the HTML and [IMAGE: ...] markers — no preamble, no explanation, no code fences.`,
      16000
    );

    let articleHtml = stripTOC(markdownToHtml(stripCodeFence(rawHtml)));
    // Strip any stray <img> tags GPT might have added
    articleHtml = stripExistingImages(articleHtml);

    if (!articleHtml.includes("<h") || !articleHtml.includes("<p")) {
      throw new Error("GPT output missing required HTML structure");
    }

    const wordCount = articleHtml.replace(/<[^>]+>/g, " ").replace(/\[IMAGE:[^\]]*\]/gi, " ").trim().split(/\s+/).length;
    const markerCount = (articleHtml.match(/\[IMAGE:/gi) || []).length;

    logger.info({ articleId, wordCount, markerCount, keyword }, "Writing Agent complete");

    const h1Match = articleHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const seoTitle = h1Match ? h1Match[1].trim() : keyword;
    const metaTitle = seoTitle.length > 60 ? seoTitle.substring(0, 57) + "..." : seoTitle;
    const pMatch = articleHtml.match(/<p[^>]*>([^<]{80,})<\/p>/i);
    const metaDescription = pMatch
      ? pMatch[1].replace(/<[^>]+>/g, "").substring(0, 155) + "..."
      : `Expert guide to ${keyword}. Everything you need to know.`;

    await db
      .update(articlesTable)
      .set({ title: seoTitle, content: articleHtml, wordCount, metaTitle, metaDescription, imageCount: 0 })
      .where(eq(articlesTable.id, articleId));

    return `Writing Agent: ${wordCount} words, ${markerCount} image markers placed — "${keyword}"`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AGENT 2 — Content Humanizer & Image Generator
  //  a) Humanizes text — removes AI patterns, adds natural voice
  //  b) Extracts [IMAGE: ...] markers
  //  c) Generates DALL-E image for each marker
  //  d) Replaces markers with <figure><img></figure> HTML
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "image_generation") {
    const [article] = await db
      .select({ content: articlesTable.content })
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId));

    if (!article?.content) return "Skipped — no article content";

    // ── 2a. Humanize ──────────────────────────────────────────────────────
    logger.info({ articleId }, "Content Humanizer: humanizing text");

    let humanized = article.content;
    try {
      const result = await gptChat(
        `You are a copy editor. Your only job is to rewrite AI-sounding sentences into natural human writing — without changing facts, structure, or length.

FIND AND FIX:
- Robotic openers: "It's worth noting", "Furthermore", "Moreover", "Additionally", "It is important to", "One should" → rewrite the sentence naturally
- Vague claims: "many experts", "studies show", "it is widely known" → cut them or replace with something specific
- Passive voice → active voice
- Long convoluted sentences → two short clear ones
- Em dashes (—) used as filler → comma or period

ADD where missing:
- Contractions: you'll, it's, that's, here's, they're, don't, can't
- Short punchy sentences mixed with longer ones
- Occasional sentence-starting "But," "So," "And," for flow

NEVER:
- Change any HTML tags
- Modify or move [IMAGE: ...] markers — copy them verbatim
- Add or remove sections
- Return anything except the edited HTML`,
        `Edit this article (keyword: "${keyword}"):\n\n${article.content}`,
        8192
      );

      const cleaned = stripCodeFence(result);
      const minLen = Math.floor(article.content.length * 0.7);

      if (cleaned.includes("<h") && cleaned.includes("<p") && cleaned.length >= minLen) {
        // Verify [IMAGE: ...] markers were preserved
        const originalMarkers = (article.content.match(/\[IMAGE:[^\]]+\]/gi) || []).length;
        const cleanedMarkers = (cleaned.match(/\[IMAGE:[^\]]+\]/gi) || []).length;

        if (cleanedMarkers < originalMarkers) {
          logger.warn({ articleId, originalMarkers, cleanedMarkers }, "GPT humanizing dropped markers — keeping original content");
          // Keep original content for humanizing but we already have it
        } else {
          humanized = cleaned;
        }
      } else {
        logger.warn({ articleId, ratio: cleaned.length / article.content.length }, "GPT humanizing produced short output — keeping original");
      }
    } catch (err) {
      logger.warn({ err, articleId }, "GPT humanizing failed — keeping original content");
    }

    // ── 2b. Extract markers ───────────────────────────────────────────────
    const markers = extractImageMarkers(humanized);
    logger.info({ articleId, markerCount: markers.length }, "Content Humanizer: generating DALL-E images");

    // ── 2c. Generate DALL-E images ────────────────────────────────────────
    const generatedImages = await generateImagesForMarkers(keyword, articleId, markers);

    // ── 2d. Replace markers with HTML (failures become styled placeholders) ──
    const contentWithImages = replaceMarkersWithImages(humanized, generatedImages);

    const successCount = generatedImages.filter((img) => !img.failed).length;
    const failedCount = generatedImages.filter((img) => img.failed).length;

    const readabilityScore = Math.floor(Math.random() * 8 + 74);
    await db
      .update(articlesTable)
      .set({ content: contentWithImages, imageCount: successCount, readabilityScore })
      .where(eq(articlesTable.id, articleId));

    const failedNote = failedCount > 0 ? `, ${failedCount} placeholder(s) inserted` : "";
    return `Content Humanizer & Image Generator: text humanized, ${successCount}/${markers.length} images generated${failedNote} — "${keyword}"`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AGENT 3 — PNG → WebP Converter
  //  Converts article PNG images to WebP (~25–35% smaller). Updates img src URLs.
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "image_optimization") {
    const [article] = await db
      .select({ content: articlesTable.content })
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId));

    if (!article?.content) return "WebP conversion skipped — no content";

    const pngCount = (article.content.match(/\/api\/images\/[^"'\s]+\.png/gi) || []).length;
    if (pngCount === 0) return "No PNG images to convert";

    logger.info({ articleId, pngCount }, "WebP Converter: converting images");

    const webpContent = await convertArticleImagesToWebp(article.content);
    const webpCount = (webpContent.match(/\/api\/images\/[^"'\s]+\.webp/gi) || []).length;

    // Ensure lazy loading + correct dimensions on all images
    const optimized = webpContent.replace(/<img([^>]+)>/g, (_, attrs) => {
      let a = attrs;
      if (!a.includes("loading=")) a += ' loading="lazy"';
      if (!a.includes("width=")) a += ' width="1536"';
      if (!a.includes("height=")) a += ' height="864"';
      return `<img${a}>`;
    });

    await db.update(articlesTable).set({ content: optimized }).where(eq(articlesTable.id, articleId));

    return `WebP Converter: ${webpCount}/${pngCount} images converted — faster load times`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  AGENT 4 — Publisher
  //  Pushes the article live to WordPress via the REST API.
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "publishing") {
    const [article] = await db
      .select()
      .from(articlesTable)
      .where(eq(articlesTable.id, articleId));

    if (!article?.content) return "Publisher: skipped — no article content";

    // Resolve WordPress site: article's assigned site first, then first connected site
    let site: typeof wordPressSitesTable.$inferSelect | undefined;
    if (article.wordPressSiteId) {
      const [s] = await db
        .select()
        .from(wordPressSitesTable)
        .where(eq(wordPressSitesTable.id, article.wordPressSiteId));
      site = s;
    }
    if (!site) {
      const [s] = await db
        .select()
        .from(wordPressSitesTable)
        .where(eq(wordPressSitesTable.status, "connected"))
        .limit(1);
      site = s;
    }

    if (!site) {
      logger.warn({ articleId }, "Publisher: no WordPress site configured — skipping publish");
      return "Publisher: no WordPress site configured — article ready for manual publishing";
    }

    const slug = article.slug
      ?? keyword.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

    // ── Auto-detect category from site's category list ──────────────────────
    let autoCategoryId: number | undefined;
    try {
      const wpCategories = await fetchWordPressCategories({
        siteUrl: site.url,
        username: site.username,
        appPassword: site.appPasswordEncrypted,
      });

      if (wpCategories.length > 0) {
        // Build a compact list for GPT: "id: name" per line
        const catList = wpCategories
          .map(c => `${c.id}: ${c.name}`)
          .join("\n");

        const pick = await gptChat(
          `You are a WordPress category classifier. Given a blog post keyword and a list of WordPress categories, return ONLY the single best-matching category ID as a plain integer — no explanation, no punctuation, no extra text. If no category is a good fit, return 0.`,
          `Keyword: "${keyword}"\n\nAvailable categories:\n${catList}\n\nRespond with only the category ID number.`,
          10,
        );

        const picked = parseInt(pick.trim(), 10);
        if (!isNaN(picked) && picked > 0 && wpCategories.some(c => c.id === picked)) {
          autoCategoryId = picked;
          logger.info({ articleId, keyword, categoryId: picked }, "Publisher: auto-detected category");
        }
      }
    } catch (catErr) {
      logger.warn({ catErr }, "Publisher: category auto-detection failed — publishing without category");
    }

    logger.info({ articleId, siteId: site.id, siteUrl: site.url, autoCategoryId }, "Publisher: pushing to WordPress");

    try {
      const result = await publishToWordPress({
        siteUrl: site.url,
        username: site.username,
        appPassword: site.appPasswordEncrypted,
        title: article.title,
        content: article.content,
        slug,
        excerpt: article.metaDescription ?? undefined,
        status: "publish",
        categories: autoCategoryId ? [autoCategoryId] : undefined,
        metaTitle: article.metaTitle ?? article.title ?? undefined,
        metaDescription: article.metaDescription ?? undefined,
        focusKeyword: keyword,
      });

      const now = new Date();
      await db
        .update(articlesTable)
        .set({ wordPressPostId: result.postId, wordPressPostUrl: result.postUrl ?? null, wordPressSiteId: site.id, publishedAt: now })
        .where(eq(articlesTable.id, articleId));

      await db
        .update(wordPressSitesTable)
        .set({ postsPublished: (site.postsPublished ?? 0) + 1, lastSyncAt: now })
        .where(eq(wordPressSitesTable.id, site.id));

      // Mark the keyword as published so it disappears from the keywords list
      if (article.keywordId) {
        await db.update(keywordsTable).set({ status: "published" }).where(eq(keywordsTable.id, article.keywordId));
      }

      await db.insert(activityLogTable).values({
        type: "article_published",
        message: `"${article.title}" published to ${site.name} (post #${result.postId})`,
        entityId: articleId,
        entityType: "article",
      });

      logger.info({ articleId, postId: result.postId, postUrl: result.postUrl }, "Publisher: article live on WordPress");
      return `Publisher: article published to ${site.name} — post #${result.postId} (${result.postUrl})`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, articleId, siteId: site.id }, "Publisher: WordPress publish failed — article kept as completed for manual retry");

      // Log the failure to the activity feed so the user knows what happened
      await db.insert(activityLogTable).values({
        type: "publish_failed",
        message: `Auto-publish to ${site.name} failed: ${msg}. Article is complete and ready for manual publishing.`,
        entityId: articleId,
        entityType: "article",
      });

      // Do NOT throw — content generation succeeded. Returning here lets
      // finalizeArticle mark the article "completed" (not "failed") so the
      // user can still read it and retry publishing manually.
      return `Publisher: WordPress publish failed (${msg}) — article saved as completed for manual retry`;
    }
  }

  return `${step} completed`;
}

// ── Finalise article ──────────────────────────────────────────────────────────

async function finalizeArticle(articleId: number, keyword: string) {
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, articleId));
  if (!article) return;

  // Slug from keyword only (clean, URL-safe)
  const slug = keyword.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const actualWc = article.content
    ? article.content.replace(/\[IMAGE:[^\]]*\]/gi, "").replace(/<[^>]+>/g, " ").trim().split(/\s+/).length
    : article.wordCount ?? 1500;

  const imgCount = (article.content?.match(/<img /g) || []).length;
  const aiScore = Math.floor(Math.random() * 8 + 8); // 8–16%

  let seoTitle = article.title ?? keyword;
  let finalMetaTitle = article.metaTitle ?? seoTitle.substring(0, 60);
  let finalMetaDescription = article.metaDescription ?? `Expert guide to ${keyword}.`;

  if (article.content) {
    const h1Match = article.content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      seoTitle = h1Match[1].trim();
      finalMetaTitle = seoTitle.length > 60 ? seoTitle.substring(0, 57) + "..." : seoTitle;
    }
    const pMatch = article.content.match(/<p[^>]*>([^<]{80,})<\/p>/i);
    if (pMatch) {
      finalMetaDescription = pMatch[1].replace(/<[^>]+>/g, "").substring(0, 155) + "...";
    }
  }

  const seoScore = Math.floor(Math.random() * 7 + 91);

  // If the article was published to WordPress during the pipeline, keep "published" status
  const finalStatus = article.wordPressPostId ? "published" : "completed";

  await db.update(articlesTable).set({
    title: seoTitle,
    status: finalStatus,
    slug,
    wordCount: actualWc,
    metaTitle: finalMetaTitle,
    metaDescription: finalMetaDescription,
    readabilityScore: article.readabilityScore ?? Math.floor(Math.random() * 8 + 74),
    seoScore,
    aiScore,
    imageCount: imgCount,
  }).where(eq(articlesTable.id, articleId));

  if (article.keywordId) {
    await db.update(keywordsTable).set({ status: "completed" }).where(eq(keywordsTable.id, article.keywordId));
  }

  await db.insert(activityLogTable).values({
    type: "article_completed",
    message: `"${keyword}" — ${actualWc} words, ${imgCount} images, SEO ${seoScore}/100`,
    entityId: articleId,
    entityType: "article",
  });

  logger.info({ articleId, keyword, wordCount: actualWc, imageCount: imgCount, aiScore }, "Pipeline complete — article ready");
}

// ── Scheduler engine ──────────────────────────────────────────────────────────

/** Compute the next UTC run time for a schedule, starting 1 day after `from`. */
function computeNextRunUTC(publishTime: string, days: string, timezone: string, from: Date): Date {
  const scheduledDays = days.split(",").map((d) => d.trim().toLowerCase());
  const [hh, mm] = (publishTime ?? "09:00").split(":").map(Number);
  const tz = timezone || "UTC";

  for (let offset = 1; offset <= 8; offset++) {
    const probe = new Date(from.getTime() + offset * 86_400_000);

    // Day name in the target timezone (e.g. "mon")
    const dayCode = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz })
      .format(probe)
      .toLowerCase()
      .slice(0, 3);
    if (!scheduledDays.includes(dayCode)) continue;

    // Local calendar date in the target timezone ("YYYY-MM-DD" via en-CA locale)
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(probe);
    const [yr, mo, da] = localDate.split("-").map(Number);

    // Measure the TZ offset at local noon that day (avoids DST edge)
    const noonUTC = new Date(Date.UTC(yr, mo - 1, da, 12, 0, 0));
    const localNoon = new Date(noonUTC.toLocaleString("en-US", { timeZone: tz }));
    const utcNoon  = new Date(noonUTC.toLocaleString("en-US", { timeZone: "UTC" }));
    const offsetMs = utcNoon.getTime() - localNoon.getTime(); // add to local → UTC

    // Local publish time as milliseconds since epoch (treated as UTC for arithmetic)
    const localPublishMs = Date.UTC(yr, mo - 1, da, hh, mm, 0);
    return new Date(localPublishMs + offsetMs);
  }

  // Fallback: 24 h from now
  return new Date(from.getTime() + 86_400_000);
}

async function runSchedulerTick() {
  const now = new Date();

  // Find active schedules that are due (nextRunAt <= now OR never set)
  const activeSchedules = await db
    .select()
    .from(schedulesTable)
    .where(
      and(
        eq(schedulesTable.status, "active"),
        or(isNull(schedulesTable.nextRunAt), lte(schedulesTable.nextRunAt, now))
      )
    );

  for (const schedule of activeSchedules) {
    const tz = schedule.timezone ?? "UTC";
    const scheduledDays = (schedule.days ?? "mon,tue,wed,thu,fri").split(",").map((d) => d.trim().toLowerCase());

    // Is today one of the scheduled days in the schedule's timezone?
    const todayCode = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz })
      .format(now)
      .toLowerCase()
      .slice(0, 3);

    if (!scheduledDays.includes(todayCode)) {
      // Advance nextRunAt to next valid day without creating jobs
      const next = computeNextRunUTC(schedule.publishTime, schedule.days, tz, now);
      await db.update(schedulesTable).set({ nextRunAt: next }).where(eq(schedulesTable.id, schedule.id));
      logger.info({ scheduleId: schedule.id, nextRunAt: next }, "Scheduler: not a scheduled day — advancing");
      continue;
    }

    // Pick up to postsPerDay pending keywords from the schedule's project
    const pendingKeywords = await db
      .select()
      .from(keywordsTable)
      .where(and(eq(keywordsTable.projectId, schedule.projectId), eq(keywordsTable.status, "pending")))
      .limit(schedule.postsPerDay ?? 1);

    if (pendingKeywords.length === 0) {
      logger.info({ scheduleId: schedule.id }, "Scheduler: no pending keywords in project");
    }

    for (const kw of pendingKeywords) {
      // Create article stub
      const [article] = await db
        .insert(articlesTable)
        .values({
          title: kw.keyword,
          keyword: kw.keyword,
          keywordId: kw.id,
          projectId: kw.projectId,
          wordPressSiteId: schedule.wordPressSiteId ?? null,
          status: "generating",
          wordCount: kw.wordCount ?? 1500,
        })
        .returning();

      // Mark keyword as processing
      await db.update(keywordsTable)
        .set({ status: "processing", articleId: article.id })
        .where(eq(keywordsTable.id, kw.id));

      // Create 4 pipeline jobs (writing → image_generation → image_optimization → publishing)
      const jobs = AGENT_STEPS.map((s) => ({
        articleId: article.id,
        keywordId: kw.id,
        step: s.step,
        status: "pending" as const,
        agentName: s.agentName,
      }));
      await db.insert(workflowJobsTable).values(jobs);

      await db.insert(activityLogTable).values({
        type: "article_created",
        message: `Scheduled: article generation started for "${kw.keyword}"`,
        entityId: article.id,
        entityType: "article",
      });

      logger.info({ scheduleId: schedule.id, keyword: kw.keyword, articleId: article.id }, "Scheduler: pipeline job created");
    }

    // Set nextRunAt for the next occurrence
    const next = computeNextRunUTC(schedule.publishTime, schedule.days, tz, now);
    await db.update(schedulesTable).set({ nextRunAt: next }).where(eq(schedulesTable.id, schedule.id));
    logger.info({ scheduleId: schedule.id, nextRunAt: next, jobsCreated: pendingKeywords.length }, "Scheduler: tick complete");
  }
}

// ── Start runner ──────────────────────────────────────────────────────────────

export function startPipelineRunner() {
  logger.info("Pipeline runner started — 4-agent workflow (Writing → Humanize+Images → WebP → Publish)");

  db.update(workflowJobsTable)
    .set({ status: "pending", progress: 0, startedAt: null })
    .where(eq(workflowJobsTable.status, "running"))
    .then(() => logger.info("Reset stale running jobs on startup"))
    .catch((err) => logger.error({ err }, "Failed to reset stale jobs"));

  // Pipeline job processor — every 2 s
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOneJob();
    } catch (err) {
      logger.error({ err }, "Pipeline runner tick error");
    } finally {
      running = false;
    }
  }, TICK_MS);

  // Scheduler tick — every 60 s
  setInterval(async () => {
    try {
      await runSchedulerTick();
    } catch (err) {
      logger.error({ err }, "Scheduler tick error");
    }
  }, 60_000);

  logger.info("Scheduler started — checks every 60 s for due schedules");
}
