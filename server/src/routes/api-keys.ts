import { Router, type IRouter } from "express";
import { eq, and, inArray, ne } from "drizzle-orm";
import { db, apiKeysTable } from "../db";
import {
  CreateApiKeyBody,
  UpdateApiKeyBody,
  UpdateApiKeyParams,
  DeleteApiKeyParams,
  TestApiKeyParams,
} from "../api-zod";
const router: IRouter = Router();

function maskKey(key: typeof apiKeysTable.$inferSelect) {
  const { keyEncrypted: _, ...rest } = key;
  return rest;
}

router.get("/api-keys", async (_req, res): Promise<void> => {
  const keys = await db.select().from(apiKeysTable).orderBy(apiKeysTable.createdAt);
  res.json(keys.map(maskKey));
});

router.post("/api-keys", async (req, res): Promise<void> => {
  const parsed = CreateApiKeyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { apiKey, purpose = "text", ...rest } = parsed.data;
  const keyPreview = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";

  // Auto-activate if no existing default covers this purpose
  const coveredPurposes = purpose === "both" ? ["text", "image", "both"] : [purpose, "both"];
  const existing = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.isDefault, true), inArray(apiKeysTable.purpose, coveredPurposes)))
    .limit(1);
  const shouldActivate = existing.length === 0;

  const [key] = await db
    .insert(apiKeysTable)
    .values({ ...rest, purpose, keyEncrypted: apiKey, keyPreview, isDefault: shouldActivate })
    .returning();
  res.status(201).json(maskKey(key));
});

router.patch("/api-keys/:id", async (req, res): Promise<void> => {
  const params = UpdateApiKeyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateApiKeyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { apiKey, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (apiKey) {
    updateData.keyEncrypted = apiKey;
    updateData.keyPreview = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";
  }
  const [key] = await db.update(apiKeysTable).set(updateData).where(eq(apiKeysTable.id, params.data.id)).returning();
  if (!key) { res.status(404).json({ error: "API key not found" }); return; }
  res.json(maskKey(key));
});

router.delete("/api-keys/:id", async (req, res): Promise<void> => {
  const params = DeleteApiKeyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(apiKeysTable).where(eq(apiKeysTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "API key not found" }); return; }
  res.sendStatus(204);
});

/** Set a key as the active/default for its purpose (clears other defaults of same purpose) */
router.post("/api-keys/:id/set-active", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
  if (!key) { res.status(404).json({ error: "API key not found" }); return; }

  // Determine which purpose groups this key covers
  const purposes = key.purpose === "both" ? ["text", "image", "both"] : [key.purpose, "both"];

  // Clear isDefault on all keys that share any of the covered purposes
  await db.update(apiKeysTable)
    .set({ isDefault: false })
    .where(and(
      ne(apiKeysTable.id, key.id),
      inArray(apiKeysTable.purpose, purposes)
    ));

  // Set this key as default
  const [updated] = await db.update(apiKeysTable)
    .set({ isDefault: true })
    .where(eq(apiKeysTable.id, key.id))
    .returning();

  res.json(maskKey(updated));
});

router.post("/api-keys/:id/test", async (req, res): Promise<void> => {
  const params = TestApiKeyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, params.data.id));
  if (!key) { res.status(404).json({ error: "API key not found" }); return; }

  let success = false;
  let message = "";

  try {
    if (key.purpose === "image" || (key.purpose === "both" && key.provider === "openai")) {
      // Test image key: list models
      const baseUrl = key.endpointUrl?.replace(/\/$/, "") ?? "https://api.openai.com/v1";
      const r = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${key.keyEncrypted}` },
        signal: AbortSignal.timeout(10_000),
      });
      success = r.ok;
      message = r.ok ? `${key.provider} key is valid` : `HTTP ${r.status}`;
    } else {
      // Test text key: small chat completion
      const baseUrl = key.endpointUrl?.replace(/\/$/, "") ??
        (key.provider === "groq" ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
      const model = key.modelName ?? (key.provider === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini");
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.keyEncrypted}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "Say OK" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(15_000),
      });
      success = r.ok;
      message = r.ok ? `${key.provider} (${model}) key is valid` : `HTTP ${r.status}: ${await r.text().catch(() => "")}`;
    }
  } catch (err: any) {
    message = err?.message ?? "Connection failed";
  }

  await db.update(apiKeysTable)
    .set({ status: success ? "active" : "error", lastTestedAt: new Date() })
    .where(eq(apiKeysTable.id, key.id));

  res.json({ success, message });
});

export default router;
