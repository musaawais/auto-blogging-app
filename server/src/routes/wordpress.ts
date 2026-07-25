import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, wordPressSitesTable } from "../db";
import {
  CreateWordPressSiteBody,
  UpdateWordPressSiteBody,
  GetWordPressSiteParams,
  UpdateWordPressSiteParams,
  DeleteWordPressSiteParams,
  TestWordPressSiteParams,
} from "../api-zod";
import { testWordPressConnection, fetchWordPressCategories } from "../lib/wordpress-publisher.js";

const router: IRouter = Router();

function maskPassword(site: typeof wordPressSitesTable.$inferSelect) {
  const { appPasswordEncrypted: _, ...rest } = site;
  return rest;
}

router.get("/wordpress/sites", async (_req, res): Promise<void> => {
  const sites = await db.select().from(wordPressSitesTable).orderBy(wordPressSitesTable.createdAt);
  res.json(sites.map(maskPassword));
});

router.post("/wordpress/sites", async (req, res): Promise<void> => {
  const parsed = CreateWordPressSiteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { appPassword, ...rest } = parsed.data;
  const [site] = await db
    .insert(wordPressSitesTable)
    .values({ ...rest, appPasswordEncrypted: appPassword, status: "connected", lastSyncAt: new Date() })
    .returning();
  res.status(201).json(maskPassword(site));
});

router.get("/wordpress/sites/:id", async (req, res): Promise<void> => {
  const params = GetWordPressSiteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [site] = await db.select().from(wordPressSitesTable).where(eq(wordPressSitesTable.id, params.data.id));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }
  res.json(maskPassword(site));
});

router.patch("/wordpress/sites/:id", async (req, res): Promise<void> => {
  const params = UpdateWordPressSiteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateWordPressSiteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { appPassword, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (appPassword) updateData.appPasswordEncrypted = appPassword;
  const [site] = await db.update(wordPressSitesTable).set(updateData).where(eq(wordPressSitesTable.id, params.data.id)).returning();
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }
  res.json(maskPassword(site));
});

router.delete("/wordpress/sites/:id", async (req, res): Promise<void> => {
  const params = DeleteWordPressSiteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(wordPressSitesTable).where(eq(wordPressSitesTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Site not found" }); return; }
  res.sendStatus(204);
});

router.post("/wordpress/sites/:id/test", async (req, res): Promise<void> => {
  const params = TestWordPressSiteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [site] = await db.select().from(wordPressSitesTable).where(eq(wordPressSitesTable.id, params.data.id));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }

  const result = await testWordPressConnection({
    siteUrl: site.url,
    username: site.username,
    appPassword: site.appPasswordEncrypted,
  });

  const newStatus = result.success ? "connected" : "error";
  await db
    .update(wordPressSitesTable)
    .set({ status: newStatus, lastSyncAt: new Date() })
    .where(eq(wordPressSitesTable.id, site.id));

  res.json({ success: result.success, message: result.message, blogName: result.blogName });
});

/** Fetch live categories from a WordPress site's REST API */
router.get("/wordpress/sites/:id/categories", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [site] = await db.select().from(wordPressSitesTable).where(eq(wordPressSitesTable.id, id));
  if (!site) { res.status(404).json({ error: "Site not found" }); return; }
  try {
    const categories = await fetchWordPressCategories({
      siteUrl: site.url,
      username: site.username,
      appPassword: site.appPasswordEncrypted,
    });
    res.json(categories);
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? "Failed to fetch categories" });
  }
});

export default router;
