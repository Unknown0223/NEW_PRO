/**
 * `prisma generate`ni kerak bo‘lganda chaqiradi.
 * - Client/query engine yo‘q yoki buzilgan bo‘lsa — generate.
 * - `schema.prisma` yoki har bir migratsiya papkasidagi `migration.sql` fayli
 *   `node_modules/.prisma/client/index.js` dan yangiroq bo‘lsa — generate (stale client).
 * Aks holda o‘tkazilmaydi (Windowsda har safar generate EPERM berishi mumkin).
 *
 * Qo‘lda: boshqa Node jarayonlarini to‘xtating, keyin `npx prisma generate`.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const backendRoot = path.join(__dirname, "..");
const clientDir = path.join(backendRoot, "node_modules", ".prisma", "client");
const indexJs = path.join(clientDir, "index.js");
const schemaPath = path.join(backendRoot, "prisma", "schema.prisma");
const modelsDir = path.join(backendRoot, "prisma", "models");
const migrationsDir = path.join(backendRoot, "prisma", "migrations");

function prismaClientLooksReady() {
  if (!fs.existsSync(indexJs) || !fs.existsSync(clientDir)) return false;
  let names;
  try {
    names = fs.readdirSync(clientDir);
  } catch {
    return false;
  }
  return names.some(
    (n) => n.includes("query_engine") && (n.endsWith(".node") || n.endsWith(".so.node"))
  );
}

/** Schema (asosiy + models/) yoki migratsiyalar client yaratilgan vaqtdan yangi bo‘lsa — generate. */
function prismaClientStaleVsSchema() {
  if (!fs.existsSync(indexJs)) return false;
  let sourcesMs = 0;
  try {
    if (fs.existsSync(schemaPath)) sourcesMs = Math.max(sourcesMs, fs.statSync(schemaPath).mtimeMs);
  } catch {
    /* skip */
  }
  try {
    if (fs.existsSync(modelsDir)) {
      for (const name of fs.readdirSync(modelsDir)) {
        if (!name.endsWith(".prisma")) continue;
        try {
          sourcesMs = Math.max(sourcesMs, fs.statSync(path.join(modelsDir, name)).mtimeMs);
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* skip */
  }
  try {
    if (fs.existsSync(migrationsDir)) {
      for (const name of fs.readdirSync(migrationsDir)) {
        const sql = path.join(migrationsDir, name, "migration.sql");
        if (!fs.existsSync(sql)) continue;
        try {
          sourcesMs = Math.max(sourcesMs, fs.statSync(sql).mtimeMs);
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* skip */
  }
  if (sourcesMs <= 0) return false;
  let clientMs = 0;
  try {
    clientMs = fs.statSync(indexJs).mtimeMs;
  } catch {
    return true;
  }
  return sourcesMs > clientMs + 500;
}

if (prismaClientLooksReady() && !prismaClientStaleVsSchema()) {
  console.log("[prisma-generate-if-needed] Client mavjud va schema bilan mos — generate o‘tkazilmaydi.");
  process.exit(0);
}

if (prismaClientLooksReady() && prismaClientStaleVsSchema()) {
  console.log("[prisma-generate-if-needed] Schema/migratsiyalar clientdan yangi — generate qilinmoqda...");
} else if (!prismaClientLooksReady()) {
  console.log("[prisma-generate-if-needed] Client to‘liq emas — generate qilinmoqda...");
}
const r = spawnSync("node", [path.join(__dirname, "prisma-generate-retry.cjs")], {
  stdio: "inherit",
  cwd: backendRoot,
  shell: false
});
process.exit(r.status ?? 1);
