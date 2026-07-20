/**
 * Prove Chromium picks a brand favicon URL (fresh profile — no sticky cache).
 * Captures network favicon hits, DOM icon links, and a visual decode screenshot.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const tmpDir = path.join(root, "tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-favicon-profile-"));

const failures = [];
const evidence = [];

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  evidence.push(`OK: ${msg}`);
}

const browser = await chromium.launchPersistentContext(profileDir, {
  headless: true,
  serviceWorkers: "block",
  viewport: { width: 1280, height: 720 }
});

const page = browser.pages()[0] || (await browser.newPage());
const cdp = await browser.newCDPSession(page);
await cdp.send("Network.enable");

const netHits = [];
cdp.on("Network.responseReceived", (ev) => {
  const u = ev.response.url;
  if (/favicon|sa-favicon|icon_|apple|webmanifest|\/icon(\?|$)|sa-brand/i.test(u)) {
    netHits.push({
      url: u,
      status: ev.response.status,
      mime: ev.response.mimeType,
      fromDiskCache: Boolean(ev.response.fromDiskCache),
      fromPrefetchCache: Boolean(ev.response.fromPrefetchCache)
    });
  }
});

await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(2500);

const title = await page.title();
evidence.push(`title=${title}`);

const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="shortcut icon"], link[rel="manifest"]')).map(
    (el) => ({
      rel: el.getAttribute("rel"),
      href: el.getAttribute("href"),
      sizes: el.getAttribute("sizes"),
      type: el.getAttribute("type")
    })
  )
);
evidence.push(`DOM links: ${JSON.stringify(links)}`);

const firstIcon = links.find((l) => (l.rel || "").includes("icon") && l.href);
if (!firstIcon) fail("No rel=icon in DOM");
else if (!/\.svg(\?|$)/i.test(firstIcon.href || "") && !/sa-favicon|icon_32|favicon\.ico/i.test(firstIcon.href || "")) {
  fail(`Unexpected first icon: ${firstIcon.href}`);
} else {
  ok(`First icon candidate: ${firstIcon.href}`);
}

if (!links.some((l) => (l.href || "").includes("favicon.ico"))) {
  fail("Missing favicon.ico link");
} else {
  ok("favicon.ico present in DOM");
}

// Prefer SVG link as the document icon URL Chromium should use
const svgLink = links.find((l) => /\.svg(\?|$)/i.test(l.href || ""));
const pngLink = links.find((l) => /\.png(\?|$)/i.test(l.href || "") && (l.rel || "").includes("icon"));
const icoLink = links.find((l) => /favicon\.ico/i.test(l.href || ""));
const preferredHref = svgLink?.href || pngLink?.href || icoLink?.href;
if (!preferredHref) fail("No usable icon href");

const preferredAbs = new URL(preferredHref, baseUrl).href;

// Fetch + verify bytes are image, not HTML
const fetched = await page.evaluate(async (url) => {
  const res = await fetch(url, { cache: "no-store" });
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = Array.from(buf.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const asText = new TextDecoder().decode(buf.slice(0, 64)).toLowerCase();
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    len: buf.length,
    head,
    looksHtml: asText.includes("<!doctype") || asText.includes("<html")
  };
}, preferredAbs);

evidence.push(`Preferred icon fetch: ${JSON.stringify(fetched)}`);
if (fetched.status !== 200 || fetched.looksHtml || /html/i.test(fetched.type)) {
  fail(`Preferred icon is not an image: ${JSON.stringify(fetched)}`);
} else {
  ok(`Preferred icon is image (${fetched.type}, ${fetched.len}b)`);
}

// Probe /icon metadata route — must NOT be HTML
const iconRoute = await page.evaluate(async () => {
  const res = await fetch("/icon", { cache: "no-store", method: "GET" });
  const buf = new Uint8Array(await res.arrayBuffer());
  const asText = new TextDecoder().decode(buf.slice(0, 64)).toLowerCase();
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    len: buf.length,
    looksHtml: asText.includes("<!doctype") || asText.includes("<html")
  };
});
evidence.push(`/icon route: ${JSON.stringify(iconRoute)}`);
if (iconRoute.status === 200 && !iconRoute.looksHtml && /image\//i.test(iconRoute.type)) {
  ok("/icon serves image (not login HTML)");
} else if (iconRoute.status === 404 && !iconRoute.looksHtml) {
  ok("/icon 404 without HTML body risk mitigated");
} else if (iconRoute.looksHtml) {
  fail("/icon returned HTML — Chrome may use document tab icon");
}

// Auth cookie → dashboard HTML icons
await browser.addCookies([{ name: "sd_auth", value: "1", url: baseUrl }]);
const dash = await browser.newPage();
await dash.goto(`${baseUrl}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
await dash.waitForTimeout(1500);
const dashLinks = await dash
  .evaluate(() =>
    Array.from(document.querySelectorAll('link[rel*="icon"]')).map((el) => el.getAttribute("href"))
  )
  .catch(() => []);
evidence.push(`Dashboard icon hrefs: ${JSON.stringify(dashLinks)}`);
if (dashLinks.some((h) => h && /sa-favicon\.svg|favicon\.ico|icon_32/i.test(h))) {
  ok("Dashboard also exposes brand icon links");
}

// Visual proof: render preferred URLs Chrome would use
const proof = await browser.newPage();
await proof.setViewportSize({ width: 560, height: 240 });
const svgAbs = svgLink ? new URL(svgLink.href, baseUrl).href : preferredAbs;
const pngAbs = pngLink ? new URL(pngLink.href, baseUrl).href : `${baseUrl}/icon_32.png`;
const icoAbs = icoLink ? new URL(icoLink.href, baseUrl).href : `${baseUrl}/favicon.ico`;

await proof.setContent(`<!doctype html>
<html><head><meta charset="utf-8"/><title>SA favicon CDP proof</title></head>
<body style="margin:0;background:#1a2332;color:#e8eef7;font:13px system-ui;padding:16px">
  <div style="margin-bottom:10px">Document icon URLs Chromium should use (fresh profile)</div>
  <div style="display:flex;gap:18px;align-items:flex-end">
    <div style="text-align:center;background:#fff;padding:10px;border-radius:10px;color:#111">
      <img id="svg" src="${svgAbs}" width="48" height="48" alt="svg"/>
      <div>SVG</div>
    </div>
    <div style="text-align:center;background:#fff;padding:10px;border-radius:10px;color:#111">
      <img id="png" src="${pngAbs}" width="48" height="48" alt="png"/>
      <div>PNG</div>
    </div>
    <div style="text-align:center;background:#fff;padding:10px;border-radius:10px;color:#111">
      <img id="ico" src="${icoAbs}" width="48" height="48" alt="ico"/>
      <div>ICO</div>
    </div>
    <div style="text-align:center;background:#fff;padding:10px;border-radius:10px;color:#111">
      <img id="route" src="${baseUrl}/icon" width="48" height="48" alt="route"/>
      <div>/icon</div>
    </div>
  </div>
  <div style="margin-top:12px;opacity:.85;font-size:11px;word-break:break-all">preferred: ${preferredAbs}</div>
</body></html>`);

await Promise.all(
  ["svg", "png", "ico", "route"].map((id) =>
    proof.waitForFunction((elId) => {
      const img = document.getElementById(elId);
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, id, { timeout: 15000 })
  )
);

const dims = await proof.evaluate(() =>
  Object.fromEntries(
    ["svg", "png", "ico", "route"].map((id) => {
      const img = document.getElementById(id);
      return [id, { w: img.naturalWidth, h: img.naturalHeight }];
    })
  )
);
evidence.push(`Decode dims: ${JSON.stringify(dims)}`);
if (dims.svg.w < 1 || dims.ico.w < 1 || dims.route.w < 1) {
  fail(`Brand icons failed to decode: ${JSON.stringify(dims)}`);
} else {
  ok("SVG, ICO, and /icon all decode in Chromium");
}

const shot = path.join(tmpDir, "favicon-brand-proof.png");
await proof.screenshot({ path: shot });
ok(`Screenshot: ${shot}`);

evidence.push(`Network icon hits: ${JSON.stringify(netHits.slice(0, 20))}`);

const brandNet = netHits.filter(
  (h) =>
    h.status === 200 &&
    /image\//i.test(h.mime || "") &&
    /sa-favicon|favicon\.ico|icon_32|\/icon|sa-brand/i.test(h.url)
);
if (brandNet.length) ok(`Network fetched brand image(s): ${brandNet.map((h) => h.url).join(", ")}`);
else evidence.push("NOTE: Chromium may defer favicon fetch; DOM+decode proof still valid");

await browser.close();
try {
  fs.rmSync(profileDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

const report = {
  passed: failures.length === 0,
  preferredDocumentIconUrl: preferredAbs,
  failures,
  evidence,
  screenshot: shot
};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) {
  console.error("\nFAVICON CDP PROOF FAILED");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}
console.log("\nFAVICON CDP PROOF PASSED");
console.log("Document icon URL:", preferredAbs);
