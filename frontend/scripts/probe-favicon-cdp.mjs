/**
 * Probe what Chromium actually uses for tab favicon via network + CDP.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const tmpDir = path.join(frontendRoot, "tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

const networkHits = [];
await cdp.send("Network.enable");
cdp.on("Network.responseReceived", (e) => {
  const u = e.response.url;
  if (/favicon|sa-favicon|icon_|apple-touch|webmanifest|\/icon(\?|$)/i.test(u)) {
    networkHits.push({
      url: u,
      status: e.response.status,
      mime: e.response.mimeType,
      fromCache: e.response.fromDiskCache || e.response.fromPrefetchCache
    });
  }
});

await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="manifest"]')).map((el) => ({
    rel: el.getAttribute("rel"),
    href: el.getAttribute("href"),
    sizes: el.getAttribute("sizes"),
    type: el.getAttribute("type")
  }))
);

// Chrome's document favicon candidates (internal heuristic via fetch of link hrefs)
const resolved = [];
for (const link of links.filter((l) => (l.rel || "").includes("icon"))) {
  const abs = new URL(link.href, baseUrl).href;
  const res = await page.evaluate(async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    const buf = new Uint8Array(await r.arrayBuffer());
    return {
      status: r.status,
      type: r.headers.get("content-type") || "",
      len: buf.length,
      head: Array.from(buf.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    };
  }, abs);
  resolved.push({ ...link, abs, ...res });
}

// Also probe classic /favicon.ico
const classic = await page.evaluate(async () => {
  const r = await fetch("/favicon.ico", { cache: "no-store" });
  const buf = new Uint8Array(await r.arrayBuffer());
  return {
    status: r.status,
    type: r.headers.get("content-type") || "",
    len: buf.length,
    head: Array.from(buf.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  };
});

// Visual: serve URLs as <img> so Chrome image decoder must accept them
const proofPage = await context.newPage();
await proofPage.setViewportSize({ width: 480, height: 200 });
await proofPage.goto("about:blank");
await proofPage.setContent(`<!doctype html>
<html><body style="margin:0;padding:16px;background:#888;font:13px system-ui;color:#111">
  <div>Live served favicon decode proof</div>
  <div style="display:flex;gap:20px;margin-top:12px;align-items:flex-end">
    <div style="text-align:center;background:#fff;padding:8px;border-radius:8px">
      <img id="ico" src="${baseUrl}/favicon.ico?probe=${Date.now()}" width="48" height="48"/>
      <div>favicon.ico</div>
    </div>
    <div style="text-align:center;background:#fff;padding:8px;border-radius:8px">
      <img id="svg" src="${baseUrl}/sa-favicon.svg?probe=${Date.now()}" width="48" height="48"/>
      <div>sa-favicon.svg</div>
    </div>
    <div style="text-align:center;background:#fff;padding:8px;border-radius:8px">
      <img id="png" src="${baseUrl}/icon_32.png?probe=${Date.now()}" width="48" height="48"/>
      <div>icon_32.png</div>
    </div>
  </div>
</body></html>`);

await Promise.all(
  ["ico", "svg", "png"].map((id) =>
    proofPage.waitForFunction((elId) => {
      const img = document.getElementById(elId);
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, id)
  )
);

const dims = await proofPage.evaluate(() =>
  Object.fromEntries(
    ["ico", "svg", "png"].map((id) => {
      const img = document.getElementById(id);
      return [id, { w: img.naturalWidth, h: img.naturalHeight, complete: img.complete }];
    })
  )
);

const shot = path.join(tmpDir, "favicon-cdp-live-proof.png");
await proofPage.screenshot({ path: shot });

const report = {
  baseUrl,
  title: await page.title(),
  links,
  resolvedIconLinks: resolved,
  classicFaviconIco: classic,
  networkHits,
  liveDecodeDims: dims,
  screenshot: shot
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
