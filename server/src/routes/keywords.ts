import { Router, type IRouter } from "express";
import { eq, and, notInArray, sql } from "drizzle-orm";
import { db, keywordsTable, articlesTable, workflowJobsTable, activityLogTable } from "../db";
import {
  CreateKeywordBody,
  UpdateKeywordBody,
  GetKeywordParams,
  UpdateKeywordParams,
  DeleteKeywordParams,
  BulkImportKeywordsBody,
  RunKeywordWorkflowParams,
  ListKeywordsQueryParams,
} from "../api-zod";
import { AGENT_STEPS } from "../lib/pipeline-runner.js";

const router: IRouter = Router();

router.get("/keywords", async (req, res): Promise<void> => {
  const query = ListKeywordsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const conditions = [];
  if (query.data.projectId) conditions.push(eq(keywordsTable.projectId, query.data.projectId));
  if (query.data.status) {
    // Explicit status filter requested
    conditions.push(eq(keywordsTable.status, query.data.status));
  } else {
    // Default: hide completed and published keywords — pipeline is done, no action needed
    conditions.push(notInArray(keywordsTable.status, ["completed", "published"]));
  }
  const keywords = await db.select().from(keywordsTable).where(and(...conditions)).orderBy(keywordsTable.createdAt);
  res.json(keywords);
});

router.post("/keywords", async (req, res): Promise<void> => {
  const parsed = CreateKeywordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [keyword] = await db.insert(keywordsTable).values(parsed.data).returning();
  await db.insert(activityLogTable).values({ type: "keyword_added", message: `Keyword "${keyword.keyword}" added`, entityId: keyword.id, entityType: "keyword" });
  res.status(201).json(keyword);
});

router.post("/keywords/bulk", async (req, res): Promise<void> => {
  const parsed = BulkImportKeywordsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = parsed.data.keywords.map((k) => ({ ...k, projectId: parsed.data.projectId }));
  await db.insert(keywordsTable).values(rows);
  res.status(201).json({ imported: rows.length, total: rows.length });
});

router.get("/keywords/:id", async (req, res): Promise<void> => {
  const params = GetKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [keyword] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, params.data.id));
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.json(keyword);
});

router.patch("/keywords/:id", async (req, res): Promise<void> => {
  const params = UpdateKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateKeywordBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [keyword] = await db.update(keywordsTable).set(parsed.data).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.json(keyword);
});

router.delete("/keywords/:id", async (req, res): Promise<void> => {
  const params = DeleteKeywordParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(keywordsTable).where(eq(keywordsTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Keyword not found" }); return; }
  res.sendStatus(204);
});

router.post("/keywords/:id/run", async (req, res): Promise<void> => {
  const params = RunKeywordWorkflowParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [keyword] = await db.select().from(keywordsTable).where(eq(keywordsTable.id, params.data.id));
  if (!keyword) { res.status(404).json({ error: "Keyword not found" }); return; }

  // Create article stub — title will be replaced by proper SEO title after the writing step
  const [article] = await db
    .insert(articlesTable)
    .values({ title: keyword.keyword, keyword: keyword.keyword, keywordId: keyword.id, projectId: keyword.projectId, status: "generating", wordCount: keyword.wordCount ?? 1500 })
    .returning();

  // Update keyword status
  await db.update(keywordsTable).set({ status: "processing", articleId: article.id }).where(eq(keywordsTable.id, keyword.id));

  // Create workflow jobs
  const jobs = AGENT_STEPS.map((s) => ({ articleId: article.id, keywordId: keyword.id, step: s.step, status: "pending" as const, agentName: s.agentName }));
  const [firstJob] = await db.insert(workflowJobsTable).values(jobs).returning();

  await db.insert(activityLogTable).values({ type: "article_created", message: `Article generation started for "${keyword.keyword}"`, entityId: article.id, entityType: "article" });

  res.json(firstJob);
});

export default router;
