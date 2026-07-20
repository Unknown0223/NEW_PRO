/** @type {import('next').NextConfig} */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Webpack alias: vendor afzal; yo‘q bo‘lsa node_modules (sync crashdan himoya). */
function resolvePivotEngineAlias() {
  const vendor = path.join(__dirname, "vendor/pivot-engine");
  if (existsSync(path.join(vendor, "package.json"))) return vendor;
  const nmLocal = path.join(__dirname, "node_modules/@salec/pivot-engine");
  if (existsSync(path.join(nmLocal, "package.json"))) return nmLocal;
  try {
    return path.dirname(require.resolve("@salec/pivot-engine/package.json"));
  } catch {
    return vendor;
  }
}

const withBundleAnalyzer = process.env.ANALYZE === "true"
  ? require("@next/bundle-analyzer")({ enabled: true })
  : (config) => config;

const nextConfig = {
  eslint: {
    /** Docker/Railway prod build — mavjud lint xatolari deployni bloklamasin */
    ignoreDuringBuilds: true
  },
  typescript: {
    /** Prod deploy: typecheck alohida CI da */
    ignoreBuildErrors: true
  },
  experimental: {
    /** Dev HMR va prod bundle: faqat ishlatilgan ikonka / modul tarmoqlari */
    optimizePackageImports: ["lucide-react", "recharts"]
  },
  // @tanstack/query-core sinf ichidagi #private maydonlarni loyiha SWC orqali maqsad brauzerga moslashtiradi
  // (aks holda ba’zi muhitlarda "Invalid or unexpected token" / layout.js xatosi).
  transpilePackages: [
    "@tanstack/react-query",
    "@tanstack/query-core",
    "exceljs"
  ],
  /**
   * Dev: brauzer so‘rovlari `localhost:3000` orqali ketadi — API o‘chiq bo‘lsa
   * `net::ERR_CONNECTION_REFUSED` o‘rniga Next proxy xatosi (kamroq shovqin).
   * `NEXT_PUBLIC_API_URL` berilsa — to‘g‘ridan-to‘g‘ri API ga ulanish, rewrite yo‘q.
   */
  async rewrites() {
    /**
     * Blind Chromium `/icon` / `/apple-icon` so‘rovlari auth HTML emas, brand PNG bo‘lsin
     * (metadata.icons + app/icon.png ba’zan /icon route ni bermaydi → 404/globe).
     */
    const iconRewrites = [
      { source: "/icon", destination: "/sa-brand-v3-32.png" },
      { source: "/apple-icon", destination: "/apple-touch-icon.png" }
    ];

    /** To‘g‘ridan-to‘g‘ri backend URL — proxy kerak emas (CORS backendda ochiq bo‘lishi kerak). */
    if (process.env.NEXT_PUBLIC_API_URL?.trim()) return iconRewrites;

    const devTarget = process.env.API_INTERNAL_ORIGIN?.trim() || "http://127.0.0.1:18080";
    if (process.env.NODE_ENV === "development") {
      return [
        ...iconRewrites,
        { source: "/api/:path*", destination: `${devTarget}/api/:path*` },
        { source: "/auth/:path*", destination: `${devTarget}/auth/:path*` }
      ];
    }

    /**
     * Prod (masalan Railway): frontend va backend alohida — brauzer `/auth/login` ni shu hostga yuboradi.
     * `API_INTERNAL_ORIGIN` build vaqtida berilsa, Next server so‘rovni backendga proxylaydi (404 yo‘q).
     */
    const prodTarget = process.env.API_INTERNAL_ORIGIN?.trim();
    if (!prodTarget) return iconRewrites;
    return [
      ...iconRewrites,
      { source: "/api/:path*", destination: `${prodTarget}/api/:path*` },
      { source: "/auth/:path*", destination: `${prodTarget}/auth/:path*` }
    ];
  },
  webpack(config, { dev }) {
    // Package root — dist entry orqali; transpilePackages dan olib tashlangan (export * buzilmasin).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@salec/pivot-engine": resolvePivotEngineAlias()
    };
    if (dev) {
      // Windows'da disk (filesystem) pack cache yozuvi buzilib, chunk/module 404 siklini berardi.
      // Disk cache o'rniga XOTIRA (memory) cache — disk korruptsiyasi yo'q, ammo bitta
      // dev sessiya ichidagi qayta-compile (HMR / route qayta ochish) ancha tezroq bo'ladi.
      config.cache = { type: "memory" };
    }
    return config;
  }
};

export default withBundleAnalyzer(nextConfig);
