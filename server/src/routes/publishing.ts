import { Router, type IRouter } from "express";
import { eq, and, ne, notInArray } from "drizzle-orm";
import { db, publishingQueueTable, articlesTable, wordPressSitesTable, activityLogTable, keywordsTable } from "../db";
import {
  ListPublishingQueueQueryParams,
  PublishQueueItemParams,
  CancelQueueItemParams,
} from "../api-zod";
import { publishToWordPress } from "../lib/wordpress-publisher.js";

const router: IRouter = Router();

async function enrichQueueItem(item: typeof publishingQueueTable.$inferSelect) {
  const [article] = await db.select({ title: articlesTable.title }).from(articlesTable).where(eq(articlesTable.id, item.articleId));
  const [site] = await db.select({ name: wordPressSitesTable.name }).from(wordPressSitesTable).where(eq(wordPressSitesTable.id, item.siteId));
  return {
    ...item,
    articleTitle: article?.title ?? "Unknown",
    siteName: site?.name ?? "Unknown",
  };
}

// Add article to publishing queue
router.post("/publishing/queue", async (req, res): Promise<void> => {
  const { articleId, siteId, scheduledAt, categoryId } = req.body ?? {};
  if (typeof articleId !== "number" || typeof siteId !== "number") {
    res.status(400).json({ error: "articleId and siteId (numbers) are required" });
    return;
  }

  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, articleId));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }

  const [site] = await db.select().from(wordPressSitesTable).where(eq(wordPressSitesTable.id, siteId));
  if (!site) { res.status(404).json({ error: "WordPress site not found" }); return; }

  const [item] = await db.insert(publishingQueueTable).values({
    articleId,
    siteId,
    status: "queued",
    categoryId: typeof categoryId === "number" ? categoryId : null,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
  }).returning();

  const enriched = await enrichQueueItem(item);
  res.status(201).json(enriched);
});

// Completed articles NOT yet in the queue (for "ready to publish" panel)
router.get("/publishing/ready", async (_req, res): Promise<void> => {
  const allCompleted = await db.select().from(articlesTable).where(eq(articlesTable.status, "completed"));
  const queued = await db.select({ articleId: publishingQueueTable.articleId }).from(publishingQueueTable)
    .where(ne(publishingQueueTable.status, "cancelled"));
  const queuedIds = new Set(queued.map((q) => q.articleId));
  const ready = allCompleted.filter((a) => !queuedIds.has(a.id));
  res.json(ready);
});

router.get("/publishing/queue", async (req, res): Promise<void> => {
  const query = ListPublishingQueueQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = [];
  // By default exclude published and cancelled items. Pass ?status=published to see published ones.
  if (query.data.status) {
    conditions.push(eq(publishingQueueTable.status, query.data.status));
  } else {
    conditions.push(notInArray(publishingQueueTable.status, ["published", "cancelled"]));
  }
  if (query.data.siteId) conditions.push(eq(publishingQueueTable.siteId, query.data.siteId));
  const items = await db.select().from(publishingQueueTable).where(and(...conditions)).orderBy(publishingQueueTable.createdAt);
  const enriched = await Promise.all(items.map(enrichQueueItem));
  res.json(enriched);
});

router.post("/publishing/queue/:id/publish", async (req, res): Promise<void> => {
  const params = PublishQueueItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [item] = await db.select().from(publishingQueueTable).where(eq(publishingQueueTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Queue item not found" }); return; }

  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, item.articleId));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }

  const [site] = await db.select().from(wordPressSitesTable).where(eq(wordPressSitesTable.id, item.siteId));
  if (!site) { res.status(404).json({ error: "WordPress site not found" }); return; }

  // Mark as "publishing" immediately so UI shows progress
  await db.update(publishingQueueTable).set({ status: "publishing" }).where(eq(publishingQueueTable.id, item.id));

  // Attempt real WordPress REST API publish
  let wordPressPostId: number | null = null;
  let wordPressPostUrl: string | null = null;
  let publishError: string | null = null;

  // Build slug from keyword (keyword text → url-safe slug)
  const articleSlug = article.keyword
    ? article.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  try {
    const result = await publishToWordPress({
      siteUrl: site.url,
      username: site.username,
      appPassword: site.appPasswordEncrypted,
      title: article.title,
      content: article.content ?? `<p>${article.title}</p>`,
      slug: articleSlug,
      status: "publish",
      excerpt: article.metaDescription ?? undefined,
      categories: item.categoryId ? [item.categoryId] : undefined,
      metaTitle: article.metaTitle ?? article.title,
      metaDescription: article.metaDescription ?? undefined,
      focusKeyword: article.keyword ?? undefined,
    });
    wordPressPostId = result.postId;
    wordPressPostUrl = result.postUrl;
  } catch (err: unknown) {
    publishError = err instanceof Error ? err.message : String(err);
  }

  const now = new Date();
  const finalStatus = publishError ? "failed" : "published";

  const [updated] = await db
    .update(publishingQueueTable)
    .set({
      status: finalStatus,
      publishedAt: publishError ? null : now,
      wordPressPostId,
      wordPressPostUrl,
      error: publishError,
    })
    .where(eq(publishingQueueTable.id, item.id))
    .returning();

  if (!publishError) {
    // Update article and site counters on success
    await db.update(articlesTable).set({ status: "published", publishedAt: now, wordPressPostId, wordPressPostUrl, wordPressSiteId: item.siteId }).where(eq(articlesTable.id, item.articleId));
    await db.update(wordPressSitesTable).set({ postsPublished: (site.postsPublished ?? 0) + 1, lastSyncAt: now }).where(eq(wordPressSitesTable.id, item.siteId));
    // Mark keyword as published so it disappears from the keywords list
    if (article.keywordId) {
      await db.update(keywordsTable).set({ status: "published" }).where(eq(keywordsTable.id, article.keywordId));
    }
    await db.insert(activityLogTable).values({
      type: "article_published",
      message: `"${article.title}" published to ${site.name}`,
      entityId: item.articleId,
      entityType: "article",
    });
  } else {
    await db.insert(activityLogTable).values({
      type: "publish_failed",
      message: `Failed to publish "${article.title}" to ${site.name}: ${publishError}`,
      entityId: item.articleId,
      entityType: "article",
    });
  }

  if (publishError) {
    res.status(502).json({ error: publishError, item: await enrichQueueItem(updated) });
    return;
  }

  const enriched = await enrichQueueItem(updated);
  res.json(enriched);
});

router.post("/publishing/queue/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelQueueItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [item] = await db
    .update(publishingQueueTable)
    .set({ status: "cancelled" })
    .where(eq(publishingQueueTable.id, params.data.id))
    .returning();
  if (!item) { res.status(404).json({ error: "Queue item not found" }); return; }
  const enriched = await enrichQueueItem(item);
  res.json(enriched);
});

export default router;
