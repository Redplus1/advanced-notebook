# Advanced Notebook — Production Build Guide

## Prerequisites

### All platforms
```bash
# Node.js 18+
node --version

# Rust (latest stable)
rustup update stable
rustup default stable

# Verify
cargo --version
```

### Windows
```powershell
# Microsoft C++ Build Tools (required for Rust)
# Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Install with "Desktop development with C++" workload

# WebView2 Runtime (pre-installed on Windows 11, otherwise:)
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

### macOS
```bash
xcode-select --install
```

### Linux
```bash
sudo apt install libwebkit2gtk-4.0-dev build-essential libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

---

## Install dependencies

```bash
npm install
```

---

## Development

```bash
npm run tauri:dev
```

---

## Production Builds

### Build for current platform
```bash
npm run tauri:build
```

### Build for Windows (from Windows only)
```bash
npm run build:windows
```

Output files:
```
src-tauri/target/release/bundle/
├── msi/
│   └── Advanced Notebook_1.0.0_x64_en-US.msi      ← Windows MSI installer
├── nsis/
│   └── Advanced Notebook_1.0.0_x64-setup.exe       ← Windows EXE installer
```

### Build for macOS (from macOS only)
```bash
# Intel + Apple Silicon universal binary
npm run build:macos

# Intel only
npm run build:macos-x86

# Apple Silicon only
npm run build:macos-arm
```

Output files:
```
src-tauri/target/release/bundle/
├── dmg/
│   └── Advanced Notebook_1.0.0_x64.dmg             ← macOS DMG installer
└── macos/
    └── Advanced Notebook.app                         ← macOS .app bundle
```

---

## Installing on another PC

### Windows
1. Copy `Advanced Notebook_1.0.0_x64-setup.exe` to the target PC
2. Double-click → follow the setup wizard
3. App appears in Start Menu and Desktop
4. Uninstall via Settings → Apps

### macOS
1. Copy `Advanced Notebook_1.0.0_x64.dmg` to the target Mac
2. Double-click the DMG → drag to Applications
3. Launch from Applications or Spotlight

---

## Data storage

The SQLite database is stored in the OS user data directory:

| Platform | Path |
|----------|------|
| Windows  | `%APPDATA%\com.advancednotebook.app\advanced-notebook.db` |
| macOS    | `~/Library/Application Support/com.advancednotebook.app/advanced-notebook.db` |
| Linux    | `~/.local/share/com.advancednotebook.app/advanced-notebook.db` |

**Data persists** across app updates — the database file is never touched during updates.

**Backup:** Simply copy the `.db` file to back up all notes and projects.

---

## Custom App Icon

1. Prepare a 1024×1024 RGBA PNG: `src-tauri/icons/app-icon.png`
2. Run: `node scripts/gen-icons.mjs`

Or use the official Tauri icon generator:
```bash
npm install -D @tauri-apps/tauricon
npx tauri icon src-tauri/icons/app-icon.png
```

---

## Code Signing (optional, for distribution)

### Windows
Set in `tauri.conf.json`:
```json
"windows": {
  "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

### macOS
```json
"macOS": {
  "signingIdentity": "Developer ID Application: Your Name (TEAMID)"
}
```

---

## Portable Build (Windows, no installation)

```bash
# Build first
npm run build:windows

# The .exe in release/ is the standalone binary:
src-tauri/target/release/advanced-notebook.exe
```

Copy `advanced-notebook.exe` anywhere — it runs without installation.
The database will be created in `%APPDATA%\com.advancednotebook.app\` on first run.

---

## Troubleshooting

**"cargo not found"** → Run `source ~/.cargo/env` or restart terminal

**"error: linker cc not found"** (Linux) → `sudo apt install build-essential`

**Slow first build** → Normal — Cargo compiles all Rust dependencies. Takes 3–10 min. Subsequent builds are fast.

**WebView2 error** (Windows) → Install WebView2 Runtime from Microsoft

**Build fails on macOS "unsigned"** → `sudo spctl --master-disable` temporarily, or sign the app
