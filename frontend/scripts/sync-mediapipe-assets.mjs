/**
 * MediaPipe Face Landmarker aktivlarini public/mediapipe ga nusxalaydi.
 * Offline/local: WASM node_modules dan, model Google Storage dan (bir marta).
 */
import { createWriteStream, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "mediapipe");
const wasmOut = join(outDir, "wasm");
const pkgWasm = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const modelOut = join(outDir, "face_landmarker.task");

const wasmFiles = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm"
];

mkdirSync(wasmOut, { recursive: true });

if (!existsSync(pkgWasm)) {
  console.warn("[sync-mediapipe] @mediapipe/tasks-vision topilmadi — npm ci kerak.");
  process.exit(0);
}

for (const name of wasmFiles) {
  const src = join(pkgWasm, name);
  if (!existsSync(src)) {
    console.warn(`[sync-mediapipe] missing ${name}`);
    continue;
  }
  copyFileSync(src, join(wasmOut, name));
}

if (!existsSync(modelOut)) {
  try {
    const res = await fetch(modelUrl);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(modelOut));
    console.log("[sync-mediapipe] model yuklandi");
  } catch (err) {
    console.warn("[sync-mediapipe] model yuklanmadi (CDN fallback ishlaydi):", err?.message || err);
  }
} else {
  console.log("[sync-mediapipe] model allaqachon bor");
}

console.log("[sync-mediapipe] wasm → public/mediapipe/wasm");
