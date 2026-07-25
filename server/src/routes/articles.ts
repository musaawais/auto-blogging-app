import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, articlesTable, workflowJobsTable, activityLogTable } from "../db";
import {
  GetArticleParams,
  UpdateArticleParams,
  UpdateArticleBody,
  DeleteArticleParams,
  RegenerateArticleParams,
  RegenerateArticleBody,
  ListArticlesQueryParams,
} from "../api-zod";

const router: IRouter = Router();

router.get("/articles", async (req, res): Promise<void> => {
  const query = ListArticlesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = [];
  if (query.data.projectId) conditions.push(eq(articlesTable.projectId, query.data.projectId));
  if (query.data.status) {
    // Explicit status filter requested
    conditions.push(eq(articlesTable.status, query.data.status));
  } else {
    // Default: hide published articles — they're live on WordPress, no further action needed here
    conditions.push(ne(articlesTable.status, "published"));
  }
  const articles = await db.select().from(articlesTable).where(and(...conditions)).orderBy(articlesTable.createdAt);
  res.json(articles);
});

router.get("/articles/:id", async (req, res): Promise<void> => {
  const params = GetArticleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, params.data.id));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  res.json(article);
});

router.patch("/articles/:id", async (req, res): Promise<void> => {
  const params = UpdateArticleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateArticleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { scheduledAt, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  const [article] = await db.update(articlesTable).set(updateData).where(eq(articlesTable.id, params.data.id)).returning();
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }
  res.json(article);
});

router.delete("/articles/:id", async (req, res): Promise<void> => {
  const params = DeleteArticleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(articlesTable).where(eq(articlesTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Article not found" }); return; }
  res.sendStatus(204);
});

router.post("/articles/:id/regenerate", async (req, res): Promise<void> => {
  const params = RegenerateArticleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = RegenerateArticleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, params.data.id));
  if (!article) { res.status(404).json({ error: "Article not found" }); return; }

  const stepMap: Record<string, string[]> = {
    all:      ["writing", "image_generation", "image_optimization", "publishing"],
    write:    ["writing"],
    images:   ["image_generation", "image_optimization"],
    webp:     ["image_optimization"],
    // backward-compat aliases for old step names still sent by some clients
    humanize: ["image_generation"],
    seo:      ["image_generation"],
  };
  const agentNames: Record<string, string> = {
    writing:           "Writing Agent",
    image_generation:  "Content Humanizer & Image Generator",
    image_optimization: "PNG → WebP Converter",
    publishing:        "Publisher",
  };
  const steps = stepMap[parsed.data.step] ?? ["writing"];
  const jobs = steps.map((step) => ({ articleId: article.id, keywordId: null, step, status: "pending" as const, agentName: agentNames[step] ?? step }));
  await db.update(articlesTable).set({ status: "generating" }).where(eq(articlesTable.id, article.id));
  const [firstJob] = await db.insert(workflowJobsTable).values(jobs).returning();
  await db.insert(activityLogTable).values({ type: "article_created", message: `Regeneration started for "${article.title}"`, entityId: article.id, entityType: "article" });
  res.json(firstJob);
});

export default router;
