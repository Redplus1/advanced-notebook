/**
 * Icon generator for Advanced Notebook
 * Generates all required PNG sizes + ico/icns stubs
 * Run: node scripts/gen-icons.mjs
 *
 * For production icons: replace src-tauri/icons/app-icon.png
 * with your 1024x1024 RGBA PNG, then re-run this script.
 * OR use: npx @tauri-apps/tauricon (requires @tauri-apps/tauricon package)
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const ICONS_DIR = "src-tauri/icons";
mkdirSync(ICONS_DIR, { recursive: true });

// Use Python to generate icons (built-in on macOS/Linux, available on Windows)
const script = `
import os, zlib, struct, shutil, sys

def make_png(path, size, color=(91, 106, 240, 255)):
    """Create a solid-color PNG at given size."""
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    # RGBA scanlines
    raw = b''.join(b'\\x00' + bytes(color) * size for _ in range(size))
    png = (b'\\x89PNG\\r\\n\\x1a\\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png)
    print(f'  {path}')

d = '${ICONS_DIR}'
sizes = [16, 32, 64, 128, 256, 512, 1024]
for s in sizes:
    make_png(f'{d}/{s}x{s}.png', s)

# Required by Tauri bundle
make_png(f'{d}/128x128@2x.png', 256)
make_png(f'{d}/icon.png', 512)

# Windows ICO stub (copy 32x32 PNG)
shutil.copy(f'{d}/32x32.png', f'{d}/icon.ico')

# macOS ICNS stub (copy 512x512 PNG)
shutil.copy(f'{d}/512x512.png', f'{d}/icon.icns')

print('Icons generated. For production, replace with your 1024x1024 icon.')
`;

try {
  execSync(`python3 -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: "inherit" });
} catch {
  // Try python (Windows)
  execSync(`python -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: "inherit" });
}
