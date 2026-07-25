import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, schedulesTable } from "../db";
import {
  CreateScheduleBody,
  UpdateScheduleBody,
  GetScheduleParams,
  UpdateScheduleParams,
  DeleteScheduleParams,
} from "../api-zod";

const router: IRouter = Router();

router.get("/schedules", async (_req, res): Promise<void> => {
  const schedules = await db.select().from(schedulesTable).orderBy(schedulesTable.createdAt);
  res.json(schedules);
});

router.post("/schedules", async (req, res): Promise<void> => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [schedule] = await db.insert(schedulesTable).values(parsed.data).returning();
  res.status(201).json(schedule);
});

router.get("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [schedule] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(schedule);
});

router.patch("/schedules/:id", async (req, res): Promise<void> => {
  const params = UpdateScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [schedule] = await db.update(schedulesTable).set(parsed.data).where(eq(schedulesTable.id, params.data.id)).returning();
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(schedule);
});

router.delete("/schedules/:id", async (req, res): Promise<void> => {
  const params = DeleteScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(schedulesTable).where(eq(schedulesTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.sendStatus(204);
});

export default router;
