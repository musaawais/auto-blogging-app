import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import router from "./routes";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve AI-generated images
app.use("/api/images", express.static(path.join(process.cwd(), "public", "ai-images")));

// API routes
app.use("/api", router);

// Serve the React frontend — look in extraResources first (packaged), then local dev
const candidates = [
  path.join(process.resourcesPath ?? "", "client/dist"),
  path.join(__dirname, "../../client/dist"),
  path.join(__dirname, "../../../client/dist"),
];
const staticDir = candidates.find((d) => fs.existsSync(d));

if (staticDir) {
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
