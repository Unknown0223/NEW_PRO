import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ico = fs.readFileSync(path.join(root, "public/favicon.ico"));
const png = fs.readFileSync(path.join(root, "public/icon_32.png"));
const svg = fs.readFileSync(path.join(root, "public/sa-favicon.svg"));

console.log("=== ICO PNG entries ===");
const count = ico.readUInt16LE(4);
for (let i = 0; i < count; i++) {
  const o = 6 + i * 16;
  const size = ico.readUInt32LE(o + 8);
  const off = ico.readUInt32LE(o + 12);
  const pngBuf = ico.subarray(off, off + size);
  const w = pngBuf.readUInt32BE(16);
  const h = pngBuf.readUInt32BE(20);
  console.log({
    i,
    dirW: ico[o] || 256,
    dirH: ico[o + 1] || 256,
    pngW: w,
    pngH: h,
    magic: pngBuf.subarray(0, 4).toString("hex"),
    size
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const html = `<!doctype html><html><body style="background:#777;padding:20px;display:flex;gap:16px">
<img id="a" src="data:image/x-icon;base64,${ico.toString("base64")}" width="64" height="64" alt="ico"/>
<img id="b" src="data:image/png;base64,${png.toString("base64")}" width="64" height="64" alt="png"/>
<img id="c" src="data:image/svg+xml;base64,${svg.toString("base64")}" width="64" height="64" alt="svg"/>
<img id="d" src="http://localhost:3000/favicon.ico?nocache=${Date.now()}" width="64" height="64" alt="http-ico"/>
<img id="e" src="http://localhost:3000/sa-favicon.svg?nocache=${Date.now()}" width="64" height="64" alt="http-svg"/>
<img id="f" src="http://localhost:3000/icon_32.png?nocache=${Date.now()}" width="64" height="64" alt="http-png"/>
</body></html>`;
await page.setContent(html, { waitUntil: "load" });
await page.waitForTimeout(1500);
const dims = await page.evaluate(() =>
  Object.fromEntries(
    ["a", "b", "c", "d", "e", "f"].map((id) => {
      const el = document.getElementById(id);
      return [id, { nw: el.naturalWidth, nh: el.naturalHeight, complete: el.complete }];
    })
  )
);
console.log("=== decode dims ===");
console.log(JSON.stringify(dims, null, 2));
fs.mkdirSync(path.join(root, "tmp"), { recursive: true });
await page.screenshot({ path: path.join(root, "tmp/decode-test.png") });
console.log("wrote tmp/decode-test.png");
await browser.close();
