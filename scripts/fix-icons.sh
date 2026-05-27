#!/bin/bash
# Fix icons + Spotlight cache
# Run from project root: bash scripts/fix-icons.sh

set -e
cd "$(dirname "$0")/.."
ICONS="src-tauri/icons"
ICONSET="AN_Iconset.iconset"

echo "━━━ Step 1: Build .icns with iconutil ━━━"
rm -rf "$ICONSET"
mkdir "$ICONSET"
cp "$ICONS/16x16.png"    "$ICONSET/icon_16x16.png"
cp "$ICONS/32x32.png"    "$ICONSET/icon_16x16@2x.png"
cp "$ICONS/32x32.png"    "$ICONSET/icon_32x32.png"
cp "$ICONS/64x64.png"    "$ICONSET/icon_32x32@2x.png"
cp "$ICONS/128x128.png"  "$ICONSET/icon_128x128.png"
cp "$ICONS/256x256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$ICONS/256x256.png"  "$ICONSET/icon_256x256.png"
cp "$ICONS/512x512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$ICONS/512x512.png"  "$ICONSET/icon_512x512.png"
iconutil -c icns "$ICONSET" -o "$ICONS/icon.icns"
rm -rf "$ICONSET"
echo "✓ icon.icns created"

echo ""
echo "━━━ Step 2: Fix Spotlight (removes duplicate icon) ━━━"
# Remove old app entries from Spotlight index
sudo mdutil -E /Applications 2>/dev/null || true
# Kill and restart Spotlight
sudo killall Spotlight 2>/dev/null || true
sleep 1
open /System/Library/CoreServices/Spotlight.app 2>/dev/null || true
echo "✓ Spotlight reindexed"

echo ""
echo "━━━ Step 3: Remove old cached .app if present ━━━"
if [ -d "/Applications/Advanced Notebook.app" ]; then
    sudo rm -rf "/Applications/Advanced Notebook.app"
    echo "✓ Old app removed from /Applications"
else
    echo "  (no old app found)"
fi

echo ""
echo "━━━ Done! Now rebuild the app: ━━━"
echo "  npm run tauri build -- --target aarch64-apple-darwin --bundles app"
echo ""
echo "  Then install: copy .app to /Applications"
