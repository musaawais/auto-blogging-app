import { runMigrations } from "./db/migrate";

// Run DB migrations before anything else
runMigrations();

import path from "path";
import fs from "fs";
import app from "./app";
import { startPipelineRunner } from "./lib/pipeline-runner";

const port = parseInt(process.env.PORT || "7891", 10);

// Ensure image directory exists
const imageDir = path.join(process.cwd(), "public", "ai-images");
if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir, { recursive: true });

app.listen(port, "127.0.0.1", () => {
  console.log(`[Server] HumanSEO AI running on http://localhost:${port}`);
  startPipelineRunner();
});
