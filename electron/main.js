const { app, BrowserWindow, shell, Menu, nativeTheme, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const os = require("os");
const fs = require("fs");

const PORT = 7891;
let serverProcess = null;
let mainWindow = null;

// ── Server management ──────────────────────────────────────────────────────────

function getServerScript() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server/dist/index.cjs");
  }
  return path.join(__dirname, "../server/dist/index.cjs");
}

function getDataDir() {
  return path.join(app.getPath("userData"), "humanseo-data");
}

function startServer() {
  const script = getServerScript();
  const dataDir = getDataDir();

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  serverProcess = spawn(process.execPath, [script], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      HUMANSEO_DATA_DIR: dataDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(d));
  serverProcess.stderr.on("data", (d) => process.stderr.write(d));

  serverProcess.on("exit", (code) => {
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox("Server Error", `The HumanSEO server stopped unexpectedly (code ${code}). Please restart the app.`);
    }
  });
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://localhost:${PORT}/api/healthz`, (res) => {
        if (res.statusCode === 200) resolve();
        else if (n > 0) setTimeout(() => attempt(n - 1), 500);
        else reject(new Error("Server failed to start"));
      });
      req.on("error", () => {
        if (n > 0) setTimeout(() => attempt(n - 1), 500);
        else reject(new Error("Server failed to start"));
      });
      req.end();
    };
    attempt(retries);
  });
}

// ── Window ────────────────────────────────────────────────────────────────────

function createLoadingWindow() {
  const w = new BrowserWindow({
    width: 400,
    height: 280,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: "#0f172a",
    webPreferences: { nodeIntegration: false },
    show: true,
  });

  w.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; gap: 20px;
  }
  h1 { font-size: 22px; font-weight: 700; color: #38bdf8; }
  p { font-size: 13px; color: #94a3b8; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; margin: 0 3px; animation: bounce 1.2s infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
</style>
</head>
<body>
  <h1>HumanSEO AI</h1>
  <p>Starting local server<span class="dot"></span><span class="dot"></span><span class="dot"></span></p>
</body>
</html>
`)}`);

  return w;
}

function createMainWindow() {
  nativeTheme.themeSource = "dark";

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "HumanSEO AI",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function buildMenu() {
  const template = [
    {
      label: "HumanSEO AI",
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "forceReload" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  buildMenu();
  const loading = createLoadingWindow();

  startServer();

  try {
    await waitForServer();
    loading.close();
    createMainWindow();
  } catch (err) {
    loading.close();
    dialog.showErrorBox("Startup Failed", "The HumanSEO server could not start. Check that port 7891 is free.");
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
