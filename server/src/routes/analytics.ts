import { Router, type IRouter } from "express";
import { count, avg, sql } from "drizzle-orm";
import { db, projectsTable, keywordsTable, articlesTable, workflowJobsTable, activityLogTable } from "../db";

const router: IRouter = Router();

router.get("/analytics/dashboard", async (_req, res): Promise<void> => {
  const [{ totalArticles }] = await db.select({ totalArticles: count() }).from(articlesTable);
  const [{ publishedArticles }] = await db
    .select({ publishedArticles: count() })
    .from(articlesTable)
    .where(sql`${articlesTable.status} = 'published'`);
  const [{ pendingKeywords }] = await db
    .select({ pendingKeywords: count() })
    .from(keywordsTable)
    .where(sql`${keywordsTable.status} = 'pending'`);
  const [{ activeProjects }] = await db
    .select({ activeProjects: count() })
    .from(projectsTable)
    .where(sql`${projectsTable.status} = 'active'`);
  const [{ articlesThisWeek }] = await db
    .select({ articlesThisWeek: count() })
    .from(articlesTable)
    .where(sql`${articlesTable.createdAt} >= NOW() - INTERVAL '7 days'`);
  const [{ avgSeoScore }] = await db.select({ avgSeoScore: avg(articlesTable.seoScore) }).from(articlesTable);
  const [{ avgReadabilityScore }] = await db.select({ avgReadabilityScore: avg(articlesTable.readabilityScore) }).from(articlesTable);
  const [{ totalImages }] = await db.select({ totalImages: sql<number>`COALESCE(SUM(${articlesTable.imageCount}), 0)` }).from(articlesTable);
  const [{ failedJobs }] = await db
    .select({ failedJobs: count() })
    .from(workflowJobsTable)
    .where(sql`${workflowJobsTable.status} = 'failed'`);

  const statusBreakdown = await db
    .select({ status: articlesTable.status, count: count() })
    .from(articlesTable)
    .groupBy(articlesTable.status);

  res.json({
    totalArticles: Number(totalArticles),
    publishedArticles: Number(publishedArticles),
    pendingKeywords: Number(pendingKeywords),
    activeProjects: Number(activeProjects),
    articlesThisWeek: Number(articlesThisWeek),
    avgSeoScore: Number(avgSeoScore ?? 0),
    avgReadabilityScore: Number(avgReadabilityScore ?? 0),
    totalImages: Number(totalImages ?? 0),
    publishingSuccess: Number(publishedArticles) > 0 ? Math.round((Number(publishedArticles) / Number(totalArticles)) * 100) : 0,
    failedJobs: Number(failedJobs),
    wordCountDistribution: [
      { range: "500-1000", count: 0 },
      { range: "1000-2000", count: 0 },
      { range: "2000-3000", count: 0 },
      { range: "3000+", count: 0 },
    ],
    statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: Number(s.count) })),
  });
});

router.get("/analytics/articles", async (req, res): Promise<void> => {
  const days = Number(req.query.days) || 30;

  const rows = await db.execute(
    sql`SELECT
      DATE(${articlesTable.createdAt}) as date,
      COUNT(*) as articles_created,
      COUNT(*) FILTER (WHERE ${articlesTable.status} = 'published') as articles_published
    FROM ${articlesTable}
    WHERE ${articlesTable.createdAt} >= NOW() - INTERVAL '${sql.raw(String(days))} days'
    GROUP BY DATE(${articlesTable.createdAt})
    ORDER BY date`
  );

  res.json(
    (rows.rows as Array<{ date: string; articles_created: string; articles_published: string }>).map((r) => ({
      date: r.date,
      articlesCreated: Number(r.articles_created),
      articlesPublished: Number(r.articles_published),
    }))
  );
});

router.get("/analytics/agents", async (_req, res): Promise<void> => {
  const rows = await db.execute(
    sql`SELECT
      ${workflowJobsTable.agentName} as agent,
      COUNT(*) as runs_total,
      COUNT(*) FILTER (WHERE ${workflowJobsTable.status} = 'completed') as runs_success,
      COUNT(*) FILTER (WHERE ${workflowJobsTable.status} = 'failed') as runs_failed,
      COALESCE(AVG(EXTRACT(EPOCH FROM (${workflowJobsTable.completedAt} - ${workflowJobsTable.startedAt})) * 1000), 0) as avg_duration_ms
    FROM ${workflowJobsTable}
    GROUP BY ${workflowJobsTable.agentName}
    ORDER BY runs_total DESC`
  );

  res.json(
    (rows.rows as Array<{ agent: string; runs_total: string; runs_success: string; runs_failed: string; avg_duration_ms: string }>).map((r) => ({
      agent: r.agent,
      runsTotal: Number(r.runs_total),
      runsSuccess: Number(r.runs_success),
      runsFailed: Number(r.runs_failed),
      avgDurationMs: Math.round(Number(r.avg_duration_ms)),
    }))
  );
});

router.get("/analytics/recent-activity", async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const rows = await db.select().from(activityLogTable).orderBy(activityLogTable.createdAt).limit(limit);
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
