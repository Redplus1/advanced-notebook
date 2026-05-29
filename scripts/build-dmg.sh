#!/usr/bin/env bash
set -e

APP_NAME="Advanced Notebook"

echo "==> Cleaning up stuck disk images..."
for vol in /Volumes/"$APP_NAME"*; do
  if [ -d "$vol" ]; then
    DEV=$(hdiutil info | grep -B10 "$(basename "$vol")" | grep "^/dev/" | awk '{print $1}' | head -1)
    if [ -n "$DEV" ]; then
      echo "    Detaching $DEV ($vol)"
      hdiutil detach -force "$DEV" 2>/dev/null || true
    fi
  fi
done

echo "==> Removing leftover rw.* DMG files..."
find src-tauri/target -name "rw.*.dmg" -delete 2>/dev/null || true

echo "==> Building DMG..."
npm run tauri:build -- --target aarch64-apple-darwin

echo ""
echo "==> Done! DMG is at:"
find src-tauri/target/aarch64-apple-darwin/release/bundle/dmg -name "*.dmg" ! -name "rw.*" 2>/dev/null
