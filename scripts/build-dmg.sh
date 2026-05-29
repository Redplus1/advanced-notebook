#!/usr/bin/env bash
set -e

APP_NAME="Advanced Notebook"
VERSION="1.4.0"
TARGET="aarch64-apple-darwin"
APP_PATH="src-tauri/target/${TARGET}/release/bundle/macos/${APP_NAME}.app"
DMG_OUT="src-tauri/target/${TARGET}/release/bundle/dmg/${APP_NAME}_${VERSION}.dmg"
ICON="src-tauri/icons/icon.icns"
BACKGROUND="src-tauri/installer-assets/dmg-background.png"

echo "==> Cleaning up stuck disk images..."
for vol in /Volumes/"${APP_NAME}"*; do
  if [ -d "$vol" ]; then
    DEV=$(hdiutil info | grep -B20 "$(basename "$vol")" | grep "^/dev/" | awk '{print $1}' | head -1)
    if [ -n "$DEV" ]; then
      echo "    Detaching $DEV ($vol)"
      hdiutil detach -force "$DEV" 2>/dev/null || true
    fi
  fi
done

echo "==> Removing leftover rw.* DMG files..."
find src-tauri/target -name "rw.*.dmg" -delete 2>/dev/null || true
rm -f "$DMG_OUT"

echo "==> Building .app bundle..."
# --bundles app — собирает только .app, без Tauri DMG bundler (не трогает tauri.conf.json, кэш не сбрасывается)
npm run tauri:build -- --target "$TARGET" --bundles app

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: .app not found at $APP_PATH"
  exit 1
fi

mkdir -p "src-tauri/target/${TARGET}/release/bundle/dmg"

echo "==> Creating DMG..."
CREATE_DMG_ARGS=(
  --volname "$APP_NAME"
  --volicon "$ICON"
  --window-pos 200 120
  --window-size 660 400
  --icon-size 128
  --icon "${APP_NAME}.app" 180 170
  --app-drop-link 480 170
  --no-internet-enable
  --sandbox-safe
)

if [ -f "$BACKGROUND" ]; then
  CREATE_DMG_ARGS+=(--background "$BACKGROUND")
fi

/opt/homebrew/bin/create-dmg "${CREATE_DMG_ARGS[@]}" "$DMG_OUT" "$APP_PATH"

echo ""
echo "==> Done!"
echo "    $DMG_OUT"
