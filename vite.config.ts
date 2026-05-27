import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tell Vite not to try to transform files in /public
  assetsInclude: ["**/*.wasm", "**/*.bin"],
  optimizeDeps: {
    exclude: ["vosk-browser"],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
}));
