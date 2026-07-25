import { Router, type IRouter } from "express";
import { eq, and, inArray, ne } from "drizzle-orm";
import { db, workflowJobsTable, articlesTable } from "../db";
import {
  GetWorkflowJobParams,
  RetryWorkflowJobParams,
  CancelWorkflowJobParams,
  ListWorkflowJobsQueryParams,
} from "../api-zod";

const router: IRouter = Router();

// Active pipelines — articles currently generating, with all their job steps
router.get("/workflow/active", async (_req, res): Promise<void> => {
  // Find all articles currently in-flight
  const activeArticles = await db
    .select()
    .from(articlesTable)
    .where(eq(articlesTable.status, "generating"));

  if (activeArticles.length === 0) {
    res.json([]);
    return;
  }

  const articleIds = activeArticles.map((a) => a.id);
  const jobs = await db
    .select()
    .from(workflowJobsTable)
    .where(inArray(workflowJobsTable.articleId, articleIds))
    .orderBy(workflowJobsTable.id);

  // Group jobs by article
  const pipelines = activeArticles.map((article) => ({
    article: {
      id: article.id,
      title: article.title,
      keyword: article.keyword,
      createdAt: article.createdAt,
    },
    steps: jobs.filter((j) => j.articleId === article.id),
  }));

  res.json(pipelines);
});

router.get("/workflow/jobs", async (req, res): Promise<void> => {
  const query = ListWorkflowJobsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  let conditions = [];
  if (query.data.articleId) conditions.push(eq(workflowJobsTable.articleId, query.data.articleId));
  if (query.data.status) conditions.push(eq(workflowJobsTable.status, query.data.status));
  const jobs = conditions.length
    ? await db.select().from(workflowJobsTable).where(and(...conditions)).orderBy(workflowJobsTable.createdAt)
    : await db.select().from(workflowJobsTable).orderBy(workflowJobsTable.createdAt);
  res.json(jobs);
});

router.get("/workflow/jobs/:id", async (req, res): Promise<void> => {
  const params = GetWorkflowJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [job] = await db.select().from(workflowJobsTable).where(eq(workflowJobsTable.id, params.data.id));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

router.post("/workflow/jobs/:id/retry", async (req, res): Promise<void> => {
  const params = RetryWorkflowJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [job] = await db
    .update(workflowJobsTable)
    .set({ status: "pending", error: null, progress: 0, startedAt: null, completedAt: null })
    .where(eq(workflowJobsTable.id, params.data.id))
    .returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

router.post("/workflow/jobs/:id/cancel", async (req, res): Promise<void> => {
  const params = CancelWorkflowJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [job] = await db
    .update(workflowJobsTable)
    .set({ status: "cancelled" })
    .where(eq(workflowJobsTable.id, params.data.id))
    .returning();
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

export default router;
