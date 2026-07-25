import { Router, type IRouter } from "express";
import { eq, count, sql } from "drizzle-orm";
import { db, projectsTable, keywordsTable, articlesTable } from "../db";
import {
  CreateProjectBody,
  UpdateProjectBody,
  GetProjectParams,
  UpdateProjectParams,
  DeleteProjectParams,
} from "../api-zod";

const router: IRouter = Router();

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db.select().from(projectsTable).orderBy(projectsTable.createdAt);

  const withCounts = await Promise.all(
    projects.map(async (p) => {
      const [{ kc }] = await db.select({ kc: count() }).from(keywordsTable).where(eq(keywordsTable.projectId, p.id));
      const [{ ac }] = await db.select({ ac: count() }).from(articlesTable).where(eq(articlesTable.projectId, p.id));
      const [{ pc }] = await db
        .select({ pc: count() })
        .from(articlesTable)
        .where(sql`${articlesTable.projectId} = ${p.id} AND ${articlesTable.status} = 'published'`);
      return { ...p, keywordCount: Number(kc), articleCount: Number(ac), publishedCount: Number(pc) };
    })
  );

  res.json(withCounts);
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [project] = await db.insert(projectsTable).values(parsed.data).returning();
  res.status(201).json({ ...project, keywordCount: 0, articleCount: 0, publishedCount: 0 });
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  const [{ kc }] = await db.select({ kc: count() }).from(keywordsTable).where(eq(keywordsTable.projectId, project.id));
  const [{ ac }] = await db.select({ ac: count() }).from(articlesTable).where(eq(articlesTable.projectId, project.id));
  const [{ pc }] = await db.select({ pc: count() }).from(articlesTable).where(sql`${articlesTable.projectId} = ${project.id} AND ${articlesTable.status} = 'published'`);
  res.json({ ...project, keywordCount: Number(kc), articleCount: Number(ac), publishedCount: Number(pc) });
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [project] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, params.data.id)).returning();
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }
  res.json({ ...project, keywordCount: 0, articleCount: 0, publishedCount: 0 });
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Project not found" }); return; }
  res.sendStatus(204);
});

export default router;
