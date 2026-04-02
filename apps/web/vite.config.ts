import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
  preview: {
    port: 5180,
  },
  build: {
    // SPA fallback: Vite preview server handles this natively.
    // For other static servers, copy dist/index.html to dist/404.html.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});
