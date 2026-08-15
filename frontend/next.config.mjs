/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    "@salec/pivot-engine",
    "@tanstack/react-query",
    "@tanstack/query-core",
    "@webdatarocks/react-webdatarocks",
    "@webdatarocks/webdatarocks",
    "exceljs"
  ],
  /**
   * Dev: brauzer so‘rovlari `localhost:3000` orqali ketadi — API o‘chiq bo‘lsa
   * `net::ERR_CONNECTION_REFUSED` o‘rniga Next proxy xatosi (kamroq shovqin).
   * `NEXT_PUBLIC_API_URL` berilsa — to‘g‘ridan-to‘g‘ri API ga ulanish, rewrite yo‘q.
   */
  async rewrites() {
    /** To‘g‘ridan-to‘g‘ri backend URL — proxy kerak emas (CORS backendda ochiq bo‘lishi kerak). */
    if (process.env.NEXT_PUBLIC_API_URL?.trim()) return [];

    const devTarget = process.env.API_INTERNAL_ORIGIN?.trim() || "http://127.0.0.1:18080";
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/api/:path*", destination: `${devTarget}/api/:path*` },
        { source: "/auth/:path*", destination: `${devTarget}/auth/:path*` }
      ];
    }

    /**
     * Prod (masalan Railway): frontend va backend alohida — brauzer `/auth/login` ni shu hostga yuboradi.
     * `API_INTERNAL_ORIGIN` build vaqtida berilsa, Next server so‘rovni backendga proxylaydi (404 yo‘q).
     */
    const prodTarget = process.env.API_INTERNAL_ORIGIN?.trim();
    if (!prodTarget) return [];
    return [
      { source: "/api/:path*", destination: `${prodTarget}/api/:path*` },
      { source: "/auth/:path*", destination: `${prodTarget}/auth/:path*` }
    ];
  },
  webpack(config, { dev }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@salec/pivot-engine": path.join(__dirname, "vendor/pivot-engine/dist/index.js")
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
