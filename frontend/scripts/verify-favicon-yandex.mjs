/**
 * Quick Yandex-oriented favicon verification against running Next server.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3000";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(root, "tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const evidence = [];
let failed = false;
function ok(m) {
  evidence.push("OK: " + m);
  console.log("OK:", m);
}
function fail(m) {
  failed = true;
  evidence.push("FAIL: " + m);
  console.error("FAIL:", m);
}

async function fetchBin(url) {
  const r = await fetch(url, { redirect: "manual" });
  const buf = Buffer.from(await r.arrayBuffer());
  return {
    status: r.status,
    ct: r.headers.get("content-type") || "",
    len: buf.length,
    magic: buf.subarray(0, 8).toString("hex"),
    loc: r.headers.get("location"),
    buf
  };
}

function isIco(buf) {
  return buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;
}
function isBmpDibIco(buf) {
  if (!isIco(buf)) return false;
  const n = buf.readUInt16LE(4);
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    const off = buf.readUInt32LE(o + 12);
    if (buf[off] === 0x89) return false; // PNG-in-ICO
    if (buf.readUInt32LE(off) !== 40) return false; // BITMAPINFOHEADER
  }
  return true;
}
function isPng(buf) {
  return buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG";
}
function isHtml(buf, ct) {
  return /text\/html/i.test(ct) || /^\s*</.test(buf.toString("utf8", 0, 64));
}

const assets = [
  "/favicon-sa.ico",
  "/favicon.ico",
  "/icon_32.png",
  "/icon"
];

for (const a of assets) {
  const r = await fetchBin(base + a);
  evidence.push(`${a} → ${r.status} CT=${r.ct} LEN=${r.len} MAGIC=${r.magic}`);
  console.log(`${a} → ${r.status} CT=${r.ct} LEN=${r.len}`);
  if (a.endsWith(".ico")) {
    if (r.status !== 200) fail(`${a} status ${r.status}`);
    else if (isHtml(r.buf, r.ct)) fail(`${a} returned HTML`);
    else if (!isBmpDibIco(r.buf)) fail(`${a} not classic BMP/DIB ICO`);
    else if (!/image\/(x-icon|vnd\.microsoft\.icon|ico)/i.test(r.ct) && !/octet-stream/i.test(r.ct)) {
      // still accept if magic OK
      ok(`${a} BMP ICO (CT=${r.ct})`);
    } else ok(`${a} BMP ICO 200 image`);
  } else if (a === "/icon_32.png") {
    if (r.status !== 200 || !isPng(r.buf)) fail(`${a} not PNG 200`);
    else ok(`${a} PNG 200`);
  } else if (a === "/icon") {
    if (isHtml(r.buf, r.ct)) fail("/icon returned HTML");
    else ok(`/icon not HTML (${r.status} ${r.ct})`);
  }
}

const login = await fetchBin(base + "/login");
const html = login.buf.toString("utf8");
fs.writeFileSync(path.join(tmpDir, "login-head-snippet.html"), html.slice(0, 8000));

const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
const iconLinks = linkTags.filter((l) => /rel=["'][^"']*icon/i.test(l));
console.log("icon links:", iconLinks.length);
iconLinks.forEach((l) => console.log(" ", l));

if (!/rel=["']shortcut icon["'][^>]*favicon-sa\.ico/i.test(html) && !/favicon-sa\.ico[^>]*rel=["']shortcut icon["']/i.test(html)) {
  // attribute order may vary
  const hasShortcut = iconLinks.some(
    (l) => /shortcut icon/i.test(l) && /favicon-sa\.ico/i.test(l) && /image\/x-icon/i.test(l)
  );
  if (!hasShortcut) fail('Missing shortcut icon → /favicon-sa.ico type=image/x-icon');
  else ok("shortcut icon → favicon-sa.ico");
} else ok("shortcut icon → favicon-sa.ico");

if (!iconLinks.some((l) => /favicon-sa\.ico/i.test(l) && /image\/x-icon/i.test(l))) {
  fail("Missing rel=icon favicon-sa.ico x-icon");
} else ok("rel=icon favicon-sa.ico present");

if (!iconLinks.some((l) => /icon_32\.png/i.test(l) && /image\/png/i.test(l))) {
  fail("Missing PNG 32 icon link");
} else ok("PNG 32 icon link present");

if (!/sa7-yandex/i.test(html)) fail("Cache bust sa7-yandex missing from HTML");
else ok("Cache bust sa7-yandex in HTML");

// Playwright DOM + decode
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
const domLinks = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel*="icon"]')].map((el) => ({
    rel: el.getAttribute("rel"),
    href: el.getAttribute("href"),
    type: el.getAttribute("type"),
    sizes: el.getAttribute("sizes")
  }))
);
evidence.push("DOM_LINKS " + JSON.stringify(domLinks, null, 2));
console.log("DOM links:", JSON.stringify(domLinks, null, 2));

if (!domLinks.some((l) => (l.href || "").includes("favicon-sa.ico"))) {
  fail("Playwright DOM missing favicon-sa.ico");
} else ok("Playwright DOM has favicon-sa.ico");

const live = await page.evaluate(async () => {
  const paths = ["/favicon-sa.ico", "/favicon.ico", "/icon_32.png"];
  const out = {};
  for (const p of paths) {
    const r = await fetch(p + "?probe=" + Date.now(), { cache: "no-store" });
    const buf = new Uint8Array(await r.arrayBuffer());
    out[p] = {
      status: r.status,
      ct: r.headers.get("content-type"),
      len: buf.length,
      magic: [...buf.slice(0, 4)].map((x) => x.toString(16).padStart(2, "0")).join("")
    };
  }
  return out;
});
evidence.push("LIVE_FETCH " + JSON.stringify(live));
console.log("Live fetch:", JSON.stringify(live, null, 2));

if (live["/favicon-sa.ico"]?.status !== 200 || live["/favicon-sa.ico"]?.magic !== "00000100") {
  fail("Live favicon-sa.ico bad");
} else ok("Live favicon-sa.ico ICO magic");

const shotHtml = `<!doctype html><html><body style="margin:24px;font-family:sans-serif;background:#111;color:#eee">
<h1>Yandex-path favicon decode</h1>
<div style="display:flex;gap:24px;align-items:flex-end">
  <div><img src="${base}/favicon-sa.ico?v=proof" width="48" height="48"/><div>favicon-sa.ico</div></div>
  <div><img src="${base}/favicon.ico?v=proof" width="48" height="48"/><div>favicon.ico</div></div>
  <div><img src="${base}/icon_32.png?v=proof" width="48" height="48"/><div>icon_32.png</div></div>
</div>
</body></html>`;
const proofPage = await context.newPage();
await proofPage.setContent(shotHtml, { waitUntil: "networkidle" });
await proofPage.waitForTimeout(500);
const shot = path.join(tmpDir, "favicon-yandex-proof.png");
await proofPage.screenshot({ path: shot, fullPage: true });
ok("Screenshot " + shot);

await browser.close();

fs.writeFileSync(path.join(tmpDir, "favicon-yandex-report.json"), JSON.stringify({ evidence, failed }, null, 2));
if (failed) {
  console.error("\nVERIFICATION FAILED");
  process.exit(1);
}
console.log("\nVERIFICATION PASSED");
