/**
 * Build a classic multi-size BMP/DIB favicon.ico (not PNG-in-ICO).
 * Yandex Browser and older Chromium forks often reject or ignore PNG payloads in ICO.
 *
 * Usage: node scripts/build-favicon-ico.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const sources = [
  path.join(root, "public/brand/favicon/icon_16.png"),
  path.join(root, "public/brand/favicon/icon_32.png"),
  path.join(root, "public/brand/favicon/icon_48.png")
];

/** 32-bpp BGRA XOR + 1-bpp AND mask (classic ICO DIB). */
function pngToDib(pngBuf) {
  const png = PNG.sync.read(pngBuf);
  const w = png.width;
  const h = png.height;
  const xorStride = w * 4; // 32bpp already DWORD-aligned
  const xorSize = xorStride * h;
  // AND mask: 1 bit/pixel, rows padded to 32-bit boundary
  const andStride = ((w + 31) >> 5) << 2;
  const andSize = andStride * h;

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(w, 4); // biWidth
  header.writeInt32LE(h * 2, 8); // biHeight includes AND mask
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(xorSize + andSize, 20); // biSizeImage
  // rest zeros (resolution / colors)

  const xor = Buffer.alloc(xorSize);
  const and = Buffer.alloc(andSize); // transparent where alpha==0

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y; // bottom-up
    for (let x = 0; x < w; x++) {
      const si = (srcY * w + x) * 4;
      const di = y * xorStride + x * 4;
      const r = png.data[si];
      const g = png.data[si + 1];
      const b = png.data[si + 2];
      const a = png.data[si + 3];
      xor[di] = b;
      xor[di + 1] = g;
      xor[di + 2] = r;
      xor[di + 3] = a;
      if (a < 128) {
        const byteIndex = y * andStride + (x >> 3);
        and[byteIndex] |= 0x80 >> (x & 7);
      }
    }
  }

  return { w, h, buf: Buffer.concat([header, xor, and]) };
}

function buildBmpIco(dibs) {
  const count = dibs.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries = dibs.map((d) => {
    const entry = { w: d.w, h: d.h, size: d.buf.length, offset, buf: d.buf };
    offset += d.buf.length;
    return entry;
  });

  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2); // type = icon
  out.writeUInt16LE(count, 4);

  for (let i = 0; i < count; i++) {
    const e = entries[i];
    const o = 6 + i * 16;
    out[o] = e.w >= 256 ? 0 : e.w;
    out[o + 1] = e.h >= 256 ? 0 : e.h;
    out[o + 2] = 0;
    out[o + 3] = 0;
    out.writeUInt16LE(1, o + 4); // planes
    out.writeUInt16LE(32, o + 6); // bit count
    out.writeUInt32LE(e.size, o + 8);
    out.writeUInt32LE(e.offset, o + 12);
    e.buf.copy(out, e.offset);
  }
  return out;
}

for (const src of sources) {
  if (!fs.existsSync(src)) {
    console.error("Missing source PNG:", src);
    process.exit(1);
  }
  const buf = fs.readFileSync(src);
  if (buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") {
    console.error("Not a PNG:", src);
    process.exit(1);
  }
}

const dibs = sources.map((s) => pngToDib(fs.readFileSync(s)));
const ico = buildBmpIco(dibs);

// New path + root — Yandex sticks to host:port /favicon.ico; new name forces refetch.
const targets = [
  path.join(root, "public/favicon.ico"),
  path.join(root, "public/favicon-sa.ico"),
  path.join(root, "public/sa-favicon.ico"),
  path.join(root, "public/brand/favicon/favicon.ico")
];

for (const t of targets) {
  fs.mkdirSync(path.dirname(t), { recursive: true });
  fs.writeFileSync(t, ico);
  console.log("Wrote", path.relative(root, t), `(${ico.length} bytes, BMP/DIB)`);
}

const copies = [
  ["public/brand/favicon/icon_16.png", "public/icon_16.png"],
  ["public/brand/favicon/icon_16.png", "public/sa-favicon-16.png"],
  ["public/brand/favicon/icon_32.png", "public/icon_32.png"],
  ["public/brand/favicon/icon_32.png", "public/sa-favicon-32.png"],
  ["public/brand/favicon/icon_48.png", "public/icon_48.png"],
  ["public/brand/icon_transparent.svg", "public/favicon.svg"],
  ["public/brand/icon_transparent.svg", "public/sa-favicon.svg"],
  ["public/brand/favicon/icon_32.png", "app/icon.png"],
  ["public/brand/favicon/icon_180.png", "app/apple-icon.png"],
  ["public/brand/favicon/icon_180.png", "public/apple-touch-icon.png"]
];

for (const [from, to] of copies) {
  const src = path.join(root, from);
  const dest = path.join(root, to);
  if (!fs.existsSync(src)) {
    console.warn("Skip missing", from);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("Copied", from, "→", to);
}

console.log("Done.");
