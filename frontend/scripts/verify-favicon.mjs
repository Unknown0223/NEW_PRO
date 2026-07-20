/**
 * Favicon end-to-end verification for SalesArena.
 * Expects: public/favicon.ico (ICO magic), layout link rel=icon → /favicon.ico,
 * no app/favicon.ico conflict, middleware must not serve HTML for icon assets.
 *
 * Usage: node scripts/verify-favicon.mjs [baseUrl]
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const tmpDir = path.join(frontendRoot, "tmp");
const screenshotPath = path.join(tmpDir, "favicon-brand-proof.png");

const failures = [];
const evidence = [];

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  evidence.push(`OK: ${msg}`);
}

function isIcoMagic(buf) {
  return buf.length >= 4 && buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00;
}

function isHtml(buf, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  if (buf.length > 0 && (buf[0] === 0x3c /* < */ || buf[0] === 0xef)) {
    const head = buf.subarray(0, Math.min(64, buf.length)).toString("utf8").toLowerCase();
    return head.includes("<!doctype") || head.includes("<html");
  }
  return false;
}

async function fetchBin(url, { redirect = "manual" } = {}) {
  const res = await fetch(url, {
    redirect,
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
  });
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  return {
    url,
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    location: res.headers.get("location") || "",
    buf,
    len: buf.length
  };
}

// --- 1. Filesystem conflict check ---
const appFavicon = path.join(frontendRoot, "app", "favicon.ico");
const publicFavicon = path.join(frontendRoot, "public", "favicon.ico");
const appIconFiles = [
  path.join(frontendRoot, "app", "icon.tsx"),
  path.join(frontendRoot, "app", "icon.js"),
  path.join(frontendRoot, "app", "icon.ts"),
  path.join(frontendRoot, "app", "apple-icon.tsx"),
  path.join(frontendRoot, "app", "apple-icon.js")
];

if (fs.existsSync(appFavicon) && fs.existsSync(publicFavicon)) {
  fail("Conflicting app/favicon.ico + public/favicon.ico (Next can 500)");
} else {
  ok("No app/public favicon.ico conflict");
}

for (const f of appIconFiles) {
  if (fs.existsSync(f)) {
    fail(`Leftover app icon route file: ${path.relative(frontendRoot, f)}`);
  }
}
if (!fs.existsSync(publicFavicon)) {
  fail("Missing public/favicon.ico");
} else {
  const diskIco = fs.readFileSync(publicFavicon);
  if (!isIcoMagic(diskIco)) fail("public/favicon.ico has invalid ICO magic");
  else ok(`public/favicon.ico on disk (${diskIco.length} bytes, ICO magic OK)`);
}

// --- 2. HTTP probes ---
const ico = await fetchBin(`${baseUrl}/favicon.ico`);
evidence.push(
  `GET /favicon.ico → ${ico.status} CT=${ico.contentType} LEN=${ico.len} MAGIC=${ico.buf.subarray(0, 4).toString("hex")}`
);
if (ico.status !== 200) fail(`/favicon.ico status ${ico.status}, expected 200`);
if (isHtml(ico.buf, ico.contentType)) fail("/favicon.ico returned HTML (auth redirect or error page)");
if (!/(image\/(x-icon|vnd\.microsoft\.icon|icon)|application\/octet-stream)/i.test(ico.contentType) &&
    !ico.contentType.includes("icon")) {
  // still accept if magic is valid ICO
  if (!isIcoMagic(ico.buf)) fail(`/favicon.ico unexpected Content-Type: ${ico.contentType}`);
}
if (!isIcoMagic(ico.buf)) fail("/favicon.ico invalid ICO magic (want 00000100)");
else ok("/favicon.ico is valid ICO");

const manifest = await fetchBin(`${baseUrl}/site.webmanifest`);
evidence.push(
  `GET /site.webmanifest → ${manifest.status} CT=${manifest.contentType} LOC=${manifest.location}`
);
if (manifest.status === 307 || manifest.status === 302 || /login/i.test(manifest.location)) {
  fail("/site.webmanifest redirected to login (middleware exclusion missing)");
} else if (manifest.status !== 200) {
  fail(`/site.webmanifest status ${manifest.status}`);
} else if (isHtml(manifest.buf, manifest.contentType)) {
  fail("/site.webmanifest returned HTML");
} else {
  ok("/site.webmanifest served without auth redirect");
}

const bareIcon = await fetchBin(`${baseUrl}/icon`);
evidence.push(`GET /icon → ${bareIcon.status} LOC=${bareIcon.location} CT=${bareIcon.contentType}`);
if (bareIcon.status === 307 || bareIcon.status === 302 || /login/i.test(bareIcon.location)) {
  fail("/icon redirected to login — Chrome may use login HTML as favicon");
} else {
  ok("/icon not auth-redirected (404/other without login HTML redirect is fine)");
}

const pngs = ["icon_16.png", "icon_32.png", "icon_48.png"];
for (const name of pngs) {
  const r = await fetchBin(`${baseUrl}/${name}`);
  if (r.status !== 200 || isHtml(r.buf, r.contentType) || r.buf[0] !== 0x89) {
    fail(`/${name} bad response status=${r.status} ct=${r.contentType}`);
  } else {
    ok(`/${name} PNG ok (${r.len} bytes)`);
  }
}

// --- 3. HTML link tags ---
const loginHtml = await fetchBin(`${baseUrl}/login`, { redirect: "follow" });
const html = loginHtml.buf.toString("utf8");
const iconLinkRe = /<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*>/gi;
const iconLinks = [...html.matchAll(iconLinkRe)].map((m) => m[0]);
evidence.push("HTML icon links:");
for (const line of iconLinks) evidence.push(`  ${line}`);

const hasFaviconIco = iconLinks.some(
  (l) => /rel=["'][^"']*icon/i.test(l) && /href=["']\/favicon\.ico["']/i.test(l)
);
if (!hasFaviconIco) {
  fail('Login HTML missing <link rel="icon" href="/favicon.ico">');
} else {
  ok('Login HTML has rel="icon" → /favicon.ico');
}

const badIconHref = iconLinks.some((l) => {
  const href = /href=["']([^"']+)["']/i.exec(l)?.[1] || "";
  return href === "/icon" || href.startsWith("/icon?");
});
if (badIconHref) fail("HTML still points to broken /icon metadata route");
else ok("No broken /icon href in HTML");

// --- 4. Playwright visual proof ---
fs.mkdirSync(tmpDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  const domLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')).map(
      (el) => ({
        rel: el.getAttribute("rel"),
        href: el.getAttribute("href"),
        sizes: el.getAttribute("sizes")
      })
    )
  );
  evidence.push(`DOM icon links: ${JSON.stringify(domLinks)}`);

  if (!domLinks.some((l) => (l.href || "").includes("/favicon.ico"))) {
    fail("Playwright DOM missing /favicon.ico link");
  }

  // Explicit fetch in page context (Chrome may not always log <link rel=icon> hits).
  const liveFavicon = await page.evaluate(async () => {
    const res = await fetch("/favicon.ico", { cache: "no-store" });
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      type: res.headers.get("content-type") || "",
      len: buf.length,
      magic: Array.from(buf.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    };
  });
  evidence.push(`In-page fetch /favicon.ico: ${JSON.stringify(liveFavicon)}`);
  if (liveFavicon.status !== 200 || liveFavicon.magic !== "00000100" || /html/i.test(liveFavicon.type)) {
    fail(`In-page /favicon.ico fetch failed: ${JSON.stringify(liveFavicon)}`);
  } else {
    ok("In-page fetch of /favicon.ico is valid ICO (not HTML)");
  }

  // Visual proof from public bytes (data URLs) — proves brand mark assets decode.
  const toData = (rel, mime) =>
    `data:${mime};base64,${fs.readFileSync(path.join(frontendRoot, "public", rel)).toString("base64")}`;
  const proof = await context.newPage();
  await proof.setViewportSize({ width: 520, height: 220 });
  await proof.setContent(`<!doctype html>
<html><head><meta charset="utf-8"/><title>Favicon proof</title></head>
<body style="margin:0;background:#0a1628;color:#e8eef7;font:14px system-ui;padding:20px">
  <div style="margin-bottom:12px">SalesArena favicon brand proof</div>
  <div style="display:flex;gap:24px;align-items:flex-end">
    <div style="text-align:center"><img id="a" src="${toData("favicon.ico", "image/x-icon")}" width="64" height="64" alt="ico"/><div>ico</div></div>
    <div style="text-align:center"><img id="b" src="${toData("icon_16.png", "image/png")}" width="64" height="64" style="image-rendering:pixelated" alt="16"/><div>16</div></div>
    <div style="text-align:center"><img id="c" src="${toData("icon_32.png", "image/png")}" width="64" height="64" style="image-rendering:pixelated" alt="32"/><div>32</div></div>
    <div style="text-align:center"><img id="d" src="${toData("icon_48.png", "image/png")}" width="64" height="64" alt="48"/><div>48</div></div>
  </div>
</body></html>`);
  await Promise.all(
    ["a", "b", "c", "d"].map((id) =>
      proof.waitForFunction((elId) => {
        const img = document.getElementById(elId);
        return Boolean(img && img.complete && img.naturalWidth > 0);
      }, id)
    )
  );
  await proof.screenshot({ path: screenshotPath });
  ok(`Screenshot saved: ${screenshotPath}`);
} finally {
  await browser.close();
}

// --- Summary ---
const passed = failures.length === 0;
const report = {
  passed,
  baseUrl,
  failures,
  evidence,
  screenshot: screenshotPath
};
console.log(JSON.stringify(report, null, 2));
if (!passed) {
  console.error("\nFAVICON VERIFY FAILED:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("\nFAVICON VERIFY PASSED");
