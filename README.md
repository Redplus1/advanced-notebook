# Video Structure Studio

A minimal desktop app for creating video structure and notes.

**Stack:** Tauri + React + TypeScript + Tailwind CSS + SQLite

---

## Prerequisites

Install these before running:

### 1. Node.js (v18+)
```bash
# macOS (with Homebrew)
brew install node

# Windows – download from nodejs.org
# Linux
sudo apt install nodejs npm
```

### 2. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### 3. Tauri system dependencies

**macOS** — Xcode Command Line Tools:
```bash
xcode-select --install
```

**Linux** (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Windows** — Install:
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Win11)

---

## Installation

```bash
# Clone or extract the project
cd video-structure-studio

# Install Node dependencies
npm install
```

---

## Running

### Development mode (hot reload)
```bash
npm run tauri dev
```

This will:
1. Start the Vite dev server on `localhost:1420`
2. Compile the Rust backend
3. Open the app window

> **First run** takes ~2-5 minutes because Cargo downloads and compiles dependencies.

### Production build
```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

---

## Project Structure

```
video-structure-studio/
├── src/                          # React frontend
│   ├── components/
│   │   ├── Sidebar.tsx           # Left navigation sidebar
│   │   ├── Notes.tsx             # Notes tab (list + editor)
│   │   ├── Projects.tsx          # Projects tab (list + editor)
│   │   ├── Settings.tsx          # Settings tab
│   │   └── SaveIndicator.tsx     # Autosave status badge
│   ├── hooks/
│   │   └── useDb.ts              # SQLite CRUD + autosave hook
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   ├── App.tsx                   # Root layout
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Tailwind + global styles
│
├── src-tauri/                    # Rust/Tauri backend
│   ├── src/
│   │   ├── main.rs               # App entry
│   │   └── lib.rs                # Tauri builder + SQL plugin
│   ├── Cargo.toml                # Rust dependencies
│   ├── build.rs                  # Build script
│   └── tauri.conf.json           # App config (window, permissions)
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Database

SQLite file is stored at:
- **macOS:** `~/Library/Application Support/com.vss.app/vss.db`
- **Linux:** `~/.local/share/com.vss.app/vss.db`
- **Windows:** `%APPDATA%\com.vss.app\vss.db`

### Schema

```sql
notes    (id, title, content, tags, project_id, created_at, updated_at)
projects (id, title, description, status, video_url, created_at, updated_at)
settings (key, value)
```

---

## Features

- **Notes** — create, edit, and delete notes with tags and autosave
- **Projects** — track video projects with status (Planning / In Progress / Completed / Archived)
- **Settings** — configure autosave delay and font size
- **Autosave** — saves automatically after typing pauses
- **Dark theme** — minimal dark UI (IBM Plex Sans + Syne fonts)

---

## Extending

To add new features:
- New tab → add to `src/types/index.ts` (Tab type) + new component + register in `App.tsx` and `Sidebar.tsx`
- New DB table → extend `initSchema()` in `src/hooks/useDb.ts`
- New Tauri command → add to `src-tauri/src/lib.rs` and expose via `invoke()` in frontend
