#!/usr/bin/env node
/**
 * Eski (siqilmagan) foto hisobotlarni qayta siqish — `compressClientPhotoForStore` bilan bir xil parametrlar.
 *
 *   node scripts/recompress-client-photos.cjs --dry-run
 *   node scripts/recompress-client-photos.cjs --min-bytes=400000 --batch=10
 *
 * Faqat `data:` (bazada saqlangan) va hali tozalanmagan rasmlar; natija kichikroq bo'lsagina yoziladi.
 * Keyin joyni diskka qaytarish uchun: VACUUM FULL client_photo_reports;
 */
const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");

const MAX_EDGE = 1600;
const QUALITY = 75;
const DATA_URL_RE = /^data:(image\/[a-z+]+);base64,(.+)$/i;

function arg(name, def) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf("=");
  return eq < 0 ? true : hit.slice(eq + 1);
}

const DRY = Boolean(arg("dry-run", false));
const MIN_BYTES = Number(arg("min-bytes", 400000));
const BATCH = Number(arg("batch", 12));
const CONCURRENCY = Number(arg("concurrency", 3));
const LIMIT = Number(arg("limit", 0));

async function compress(buf) {
  const pipeline = sharp(buf, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  let out = pipeline;
  if ((meta.width ?? 0) > MAX_EDGE || (meta.height ?? 0) > MAX_EDGE) {
    out = out.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
  }
  return out.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function processRow(prisma, row, stats) {
  stats.seen += 1;
  const m = DATA_URL_RE.exec(row.image_url.trim());
  if (!m) {
    stats.skipped += 1;
    return;
  }
  try {
    const compressed = await compress(Buffer.from(m[2], "base64"));
    const next = `data:image/jpeg;base64,${compressed.toString("base64")}`;
    if (!compressed.length || next.length >= row.image_url.length * 0.8) {
      stats.skipped += 1;
      return;
    }
    if (!DRY) {
      await prisma.$executeRawUnsafe(
        `UPDATE client_photo_reports SET image_url = $1 WHERE id = $2 AND content_purged_at IS NULL`,
        next,
        row.id
      );
    }
    stats.updated += 1;
    stats.before += row.image_url.length;
    stats.after += next.length;
  } catch (e) {
    stats.failed += 1;
    console.error(`id=${row.id} failed: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  const stats = { seen: 0, updated: 0, skipped: 0, failed: 0, before: 0, after: 0 };
  const started = Date.now();
  try {
    // `octet_length` TOAST sarlavhasidan o'qiladi (rasmni yuklamaydi); `LIKE` esa har qatorni to'liq o'qib chiqadi.
    let ids = (
      await prisma.$queryRawUnsafe(
        `SELECT id FROM client_photo_reports WHERE content_purged_at IS NULL AND octet_length(image_url) > $1 ORDER BY id`,
        MIN_BYTES
      )
    ).map((r) => r.id);
    if (LIMIT) ids = ids.slice(0, LIMIT);
    console.log(`[recompress] candidates=${ids.length}`);
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, image_url FROM client_photo_reports WHERE id = ANY($1::int[]) AND content_purged_at IS NULL ORDER BY id`,
        chunk
      );
      for (let j = 0; j < rows.length; j += CONCURRENCY) {
        await Promise.all(rows.slice(j, j + CONCURRENCY).map((row) => processRow(prisma, row, stats)));
      }
      const sec = Math.round((Date.now() - started) / 1000);
      console.log(
        `[recompress] ${Math.min(i + BATCH, ids.length)}/${ids.length} last_id=${chunk.at(-1)} updated=${stats.updated} ` +
          `skipped=${stats.skipped} failed=${stats.failed} ${mb(stats.before)} -> ${mb(stats.after)} (${sec}s)${DRY ? " DRY-RUN" : ""}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(`[recompress] done: ${JSON.stringify(stats)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
