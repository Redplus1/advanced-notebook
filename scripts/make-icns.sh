#!/bin/bash
# Run this on macOS to generate a proper icon.icns using Apple's iconutil
# Usage: bash scripts/make-icns.sh

set -e
ICONS="src-tauri/icons"
ICONSET="Advanced_Notebook.iconset"

echo "Creating iconset..."
mkdir -p "$ICONSET"

# macOS iconutil requires these exact filenames
cp "$ICONS/16x16.png"    "$ICONSET/icon_16x16.png"
cp "$ICONS/32x32.png"    "$ICONSET/icon_16x16@2x.png"
cp "$ICONS/32x32.png"    "$ICONSET/icon_32x32.png"
cp "$ICONS/64x64.png"    "$ICONSET/icon_32x32@2x.png"
cp "$ICONS/128x128.png"  "$ICONSET/icon_128x128.png"
cp "$ICONS/256x256.png"  "$ICONSET/icon_128x128@2x.png"
cp "$ICONS/256x256.png"  "$ICONSET/icon_256x256.png"
cp "$ICONS/512x512.png"  "$ICONSET/icon_256x256@2x.png"
cp "$ICONS/512x512.png"  "$ICONSET/icon_512x512.png"

echo "Running iconutil..."
iconutil -c icns "$ICONSET" -o "$ICONS/icon.icns"

rm -rf "$ICONSET"
echo "✓ icon.icns created at $ICONS/icon.icns"

# Also fix title bar icon (needs to be 32x32 for Retina title bars)
echo "✓ Done! Rebuild the app: npm run build:macos-arm"
