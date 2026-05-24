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
  // Tauri expects a fixed port
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tauri file watching
      ignored: ["**/src-tauri/**"],
    },
  },
}));
