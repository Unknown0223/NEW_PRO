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

export function buildZip(files: ZipEntry[]): Blob {
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
  const end: number[] = [
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ];
  push(end);

  return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function textFile(name: string, text: string): ZipEntry {
  return { name, data: enc.encode(text) };
}
