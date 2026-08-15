import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

/** Library build: ESM + CJS for bundlers; CDN entry re-exports for script/module tags. */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        "cdn/pivot": resolve(__dirname, "src/cdn.ts")
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) => {
        if (entryName === "cdn/pivot") return format === "es" ? "cdn/pivot.js" : "cdn/pivot.cjs";
        return format === "es" ? "index.js" : "index.cjs";
      }
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "recharts",
        "@salec/pivot-engine",
        "@dnd-kit/core",
        "@dnd-kit/sortable",
        "@dnd-kit/utilities",
        "@tanstack/react-virtual",
        "lucide-react",
        "clsx",
        "tailwind-merge"
      ],
      output: {
        assetFileNames: "pivot-ui.[ext]",
        // Keep entry + shared chunk (multi-entry). Consumers resolve via package exports.
        chunkFileNames: "chunks/[name]-[hash].js"
      }
    },
    cssCodeSplit: false,
    sourcemap: true,
    emptyOutDir: true
  },
  worker: {
    format: "es"
  }
});
