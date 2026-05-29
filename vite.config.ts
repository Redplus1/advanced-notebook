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
  assetsInclude: ["**/*.wasm", "**/*.bin"],
  build: {
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "reactflow-vendor": ["reactflow"],
          "lucide-vendor": ["lucide-react"],
        },
      },
    },
  },
  esbuild: {
    // Remove console.log and debugger in production
    drop: ["console", "debugger"],
  },
}));
