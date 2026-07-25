import { Router, type IRouter } from "express";
import { db, settingsTable } from "../db";
import { sql } from "drizzle-orm";
import { UpdateSettingsBody } from "../api-zod";

const router: IRouter = Router();

async function getOrCreateSettings() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  if (settings) return settings;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const settings = await getOrCreateSettings();
  const [updated] = await db
    .update(settingsTable)
    .set(parsed.data)
    .where(sql`${settingsTable.id} = ${settings.id}`)
    .returning();
  res.json(updated);
});

export default router;
