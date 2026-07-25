# HumanSEO AI — Standalone macOS Desktop App

100% self-contained — runs its own local server + SQLite database. No internet connection required except for OpenAI API calls.

---

## Build the DMG via GitHub Actions (5 minutes)

### Step 1 — Push to GitHub

```bash
cd humanseo-desktop
git init
git add .
git commit -m "HumanSEO AI desktop app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/humanseo-desktop.git
git push -u origin main
```

### Step 2 — Run the workflow

1. Go to your repo on GitHub
2. Click **Actions** tab
3. Click **Build macOS DMG (Intel x64)**
4. Click **Run workflow** → **Run workflow**
5. Wait ~8 minutes

### Step 3 — Download

When the workflow finishes, click the run → scroll to **Artifacts** → download **HumanSEO-AI-macOS-Intel**. Unzip it to get the `.dmg`.

### Step 4 — Install

1. Open the `.dmg`
2. Drag **HumanSEO AI** to Applications
3. **First launch:** Right-click the app → **Open** (bypasses Gatekeeper for unsigned apps)

---

## First-Time Setup Inside the App

1. Launch HumanSEO AI
2. Go to **API Manager** in the sidebar
3. Click **Add API Key**
4. Paste your OpenAI API key, set purpose to **Both (Text + Images)**
5. Click **Set as Default**
6. You're ready — go to **Keywords** and add your first keyword

---

## How It Works

```
Electron app
  └── starts local Express server (port 7891)
       ├── SQLite database (~/.humanseo/humanseo.db)
       ├── /api/* routes (keywords, articles, pipeline, etc.)
       └── serves React frontend at /
```

Your data is stored locally at `~/.humanseo/humanseo.db`.

---

## To Release a New Version

```bash
git tag v1.0.1
git push --tags
```

GitHub Actions will build and automatically attach the DMG to a GitHub Release.

---

## Customising the App Icon

Replace `assets/icon.icns` with your own `.icns` file before pushing.

To convert a PNG on your Mac:
```bash
mkdir icon.iconset
for size in 16 32 64 128 256 512 1024; do
  sips -z $size $size your-logo.png --out icon.iconset/icon_${size}x${size}.png
done
iconutil -c icns icon.iconset -o assets/icon.icns
```
