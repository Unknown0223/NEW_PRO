import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** ZIP/TXT havolalarini brauzerda ochmasdan, to‘g‘ridan yuklab olishga majbur qiladi. */
const forceDownload: Plugin = {
  name: "salec-force-download",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/^\/SALEC-.*\.(zip|txt)(?:\?.*)?$/.test(req.url ?? ""))
        res.setHeader("Content-Disposition", "attachment");
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/^\/SALEC-.*\.(zip|txt)(?:\?.*)?$/.test(req.url ?? ""))
        res.setHeader("Content-Disposition", "attachment");
      next();
    });
  }
};

export default defineConfig({
  plugins: [react(), tailwindcss(), forceDownload],
  base: process.env.TAKLIFIY_EMBED === "1" ? "/taklifiy-reja/" : "/",
  build: {
    outDir:
      process.env.TAKLIFIY_EMBED === "1"
        ? path.resolve(dirname, "../../frontend/public/taklifiy-reja")
        : "dist",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "src"),
      "@salec/plans-proposal": path.resolve(dirname, "../plans-proposal/src")
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
    allowedHosts: [".e2b.app"]
  }
});

