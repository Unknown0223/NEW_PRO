/* Minimal store-only ZIP writer (no dependencies, UTF-8 filenames). */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();

function u16(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff];
}
function u32(v: number): number[] {
  return [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
}

export type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer> };

export function buildZipBytes(files: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  // Fixed DOS date: 2026-01-01 00:00 (deterministic builds)
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  const push = (arr: number[]) => chunks.push(new Uint8Array(arr));
  const pushC = (arr: number[]) => central.push(new Uint8Array(arr));

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local: number[] = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0),
    ];
    push(local);
    chunks.push(name);
    chunks.push(f.data);

    const cd: number[] = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ];
    pushC(cd);
    central.push(name);
    offset += local.length + name.length + f.data.length;
  }

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);

  const parts = [...chunks, ...central, end];
  const total = parts.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of parts) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function buildZip(files: ZipEntry[]): Blob {
  return new Blob([buildZipBytes(files) as unknown as BlobPart], { type: "application/zip" });
}

/* ------------------------------------------------------------------ */
/*  Saving — works inside sandboxed iframes (Arena preview)            */
/* ------------------------------------------------------------------ */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Synchronous base64 — keeps the click inside the user gesture. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < len ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < len ? B64[c & 63] : "=";
  }
  return out;
}

export function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${toBase64(bytes)}`;
}

export type SaveResult = { ok: boolean; mode: "data" | "blob" | "opened" | "downloaded" };

/**
 * File saqlash. Uch bosqichli zaxira:
 *  1) data: URI + <a download> — sandbox iframe'da ham ishlaydi
 *  2) blob: URL + <a download>
 *  3) yangi oynada ochish (foydalanuvchi "Saqlash"ni bosadi)
 */
export function saveBytes(bytes: Uint8Array, filename: string, mime: string): SaveResult {
  const dataUri = bytesToDataUri(bytes, mime);

  // 1. data URI download
  try {
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = filename;
    a.rel = "noopener";
    a.style.position = "fixed";
    a.style.opacity = "0";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, mode: "data" };
  } catch {
    /* continue */
  }

  // 2. blob URL download
  try {
    const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.position = "fixed";
    a.style.opacity = "0";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    return { ok: true, mode: "blob" };
  } catch {
    /* continue */
  }

  // 3. new tab
  try {
    window.open(dataUri, "_blank", "noopener");
    return { ok: true, mode: "opened" };
  } catch {
    return { ok: false, mode: "downloaded" };
  }
}

export function saveText(text: string, filename: string, mime = "text/plain;charset=utf-8"): SaveResult {
  return saveBytes(new TextEncoder().encode(text), filename, mime);
}

/** Eski API — ichki zaxira bilan. */
export function downloadBlob(blob: Blob, filename: string) {
  void blob.arrayBuffer().then((ab) => {
    saveBytes(new Uint8Array(ab), filename, blob.type || "application/octet-stream");
  });
}

/** Data URI'ni yangi oynada ochish — "yuklab bo'lmadi" holati uchun. */
export function openBytes(bytes: Uint8Array, mime: string) {
  try {
    window.open(bytesToDataUri(bytes, mime), "_blank", "noopener");
    return true;
  } catch {
    return false;
  }
}

export function textFile(name: string, text: string): ZipEntry {
  return { name, data: enc.encode(text) };
}

/* ------------------------------------------------------------------ */
/*  Static downloads — real HTTP files (work inside iframes)           */
/* ------------------------------------------------------------------ */

export const STATIC_PREFIX = "downloads/";

/** Vite base yoki sahifa joylashuvi — ikkala holatda ham ishlaydi. */
function baseUrl(): string {
  const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
  return meta.env?.BASE_URL ?? "/";
}

/** Bitta marta tekshiriladi: statik fayl serverda bormi. */
const availability = new Map<string, Promise<boolean>>();

export function staticZipAvailable(name: string): Promise<boolean> {
  const key = name;
  const cached = availability.get(key);
  if (cached) return cached;
  const probe = (async () => {
    if (typeof fetch !== "function") return false;
    try {
      const res = await fetch(`${baseUrl()}${STATIC_PREFIX}${name}`, {
        method: "GET",
        headers: { range: "bytes=0-1" },
        cache: "no-store",
      });
      return res.ok || res.status === 206;
    } catch {
      return false;
    }
  })();
  availability.set(key, probe);
  return probe;
}

export function staticZipUrl(name: string): string {
  return `${baseUrl()}${STATIC_PREFIX}${name}`;
}

/**
 * Top-level oynada yuklash sahifasi — iframe to'siqlarini chetlab o'tadi.
 * Ichida tayyor `<a download>` havolasi bor, foydalanuvchi bir bosishda
 * haqiqiy ZIP faylni oladi.
 */
export function openDownloadPage(bytes: Uint8Array, filename: string, mime: string, staticHref?: string): boolean {
  const dataHref = bytesToDataUri(bytes, mime);
  const win = window.open("", "_blank");
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    /* cross-origin */
  }
  const link = staticHref ?? dataHref;
  const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8" />
<title>${filename} — yuklab olish</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f6f4;
  font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#0e1420;padding:24px}
  .card{max-width:520px;width:100%;background:#fff;border:1px solid #e0e9e5;border-radius:22px;padding:28px;
  box-shadow:0 30px 60px -30px rgba(6,33,30,.35)}
  h1{font-size:20px;margin:0 0 6px;letter-spacing:-.02em}
  p{margin:0 0 18px;color:#677386;font-size:13.5px;line-height:1.6}
  .file{display:flex;align-items:center;gap:12px;border:1px solid #e0e9e5;border-radius:14px;padding:12px;margin-bottom:16px}
  .ico{width:40px;height:40px;border-radius:11px;background:#eaf8f5;display:grid;place-items:center;font-size:18px}
  .meta{min-width:0}.name{font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:600;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.size{font-size:11px;color:#8a93a1}
  a.btn{display:flex;align-items:center;justify-content:center;gap:8px;background:#1f66d1;color:#fff;
  text-decoration:none;border-radius:999px;padding:13px 20px;font-weight:700;font-size:13.5px}
  a.btn:hover{filter:brightness(1.06)}
  .alt{margin-top:10px;text-align:center;font-size:11.5px;color:#8a93a1}
  code{background:#f2f6f4;padding:1px 5px;border-radius:5px;font-size:11px}
  .auto{margin-top:14px;font-size:11px;color:#1e9e63;text-align:center}
</style></head><body>
<div class="card">
  <h1>Fayl tayyor</h1>
  <p>Brauzer avtomatik yuklashi mumkin. Yuklanmasa, quyidagi tugmani bosing — bu haqiqiy ZIP fayl.</p>
  <div class="file"><div class="ico">📦</div><div class="meta">
    <div class="name">${filename}</div>
    <div class="size">${(bytes.length / 1024).toFixed(1)} KB · ZIP arxiv</div>
  </div></div>
  <a class="btn" id="dl" href="${link}" download="${filename}">⬇ Yuklab olish</a>
  <div class="auto" id="auto">Avtomatik yuklash boshlandi…</div>
  <div class="alt">Muammo bo'lsa havolani nusxalang: <code>${filename}</code></div>
</div>
<script>
  var a=document.getElementById('dl');
  try{a.click();document.getElementById('auto').textContent='Yuklash boshlandi ✓';}
  catch(e){document.getElementById('auto').textContent='Tugmani bosing';}
</script></body></html>`;
  try {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  } catch {
    try {
      win.location.href = link;
      return true;
    } catch {
      win.close();
      return false;
    }
  }
}
