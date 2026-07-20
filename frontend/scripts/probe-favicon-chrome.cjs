/**
 * Chromium favicon stubborn-tab probe.
 * Fresh context → /login, capture all icon-like requests, assert image (not HTML),
 * screenshot rendered brand icons as proof under frontend/tmp/.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.FAVICON_BASE || "http://localhost:3000";
const OUT = path.join(__dirname, "tmp");
fs.mkdirSync(OUT, { recursive: true });

function isIconUrl(u) {
  try {
    const { pathname } = new URL(u);
    return (
      /favicon|icon|apple-touch|manifest|sa-brand|\.ico$/i.test(pathname) ||
      pathname === "/icon" ||
      pathname === "/apple-icon"
    );
  } catch {
    return false;
  }
}

function looksLikeHtml(buf, ct) {
  if (/text\/html/i.test(ct || "")) return true;
  const head = Buffer.from(buf).slice(0, 64).toString("utf8").trim().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

function looksLikeImage(buf, ct) {
  if (/image\//i.test(ct || "") || /manifest|json/i.test(ct || "")) {
    if (looksLikeHtml(buf, ct)) return false;
    return true;
  }
  const b = Buffer.from(buf);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50) return true; // PNG
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return true; // ICO
  if (b.length >= 4 && b.toString("utf8", 0, 4).includes("<svg")) return true;
  if (b.length >= 5 && b.toString("utf8", 0, 5) === "<?xml") return true;
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // no storage — stubborn fresh tab
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  const captured = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (!isIconUrl(url)) return;
    let body;
    try {
      body = Buffer.from(await res.body());
    } catch {
      body = Buffer.alloc(0);
    }
    const ct = res.headers()["content-type"] || "";
    captured.push({
      url,
      status: res.status(),
      contentType: ct,
      size: body.length,
      isHtml: looksLikeHtml(body, ct),
      isImage: looksLikeImage(body, ct),
      magic: body.slice(0, 8).toString("hex"),
    });
  });

  // Direct probes Chrome also does
  for (const p of [
    "/favicon.ico",
    "/sa-brand-v3.svg",
    "/sa-brand-v3.ico",
    "/sa-brand-v3-32.png",
    "/icon",
    "/apple-icon",
  ]) {
    await page.goto(BASE + p, { waitUntil: "commit", timeout: 30000 }).catch(() => {});
  }

  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  // Force-fetch each link[rel*=icon] href
  const hrefs = await page.$$eval('link[rel*="icon"], link[rel="manifest"]', (els) =>
    els.map((e) => ({ rel: e.getAttribute("rel"), href: e.href, type: e.getAttribute("type"), sizes: e.getAttribute("sizes") }))
  );
  console.log("HTML icon links:", JSON.stringify(hrefs, null, 2));

  for (const h of hrefs) {
    if (!h.href) continue;
    await page.evaluate(async (url) => {
      await fetch(url, { cache: "no-store" });
    }, h.href);
  }
  await page.waitForTimeout(800);

  // Visual proof mosaic: render brand assets as images
  await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Favicon proof</title>
    <style>
      body{font-family:Segoe UI,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
      h1{font-size:18px;margin:0 0 16px}
      .row{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}
      figure{margin:0;text-align:center}
      figcaption{font-size:11px;margin-top:8px;opacity:.8}
      img.ico{width:16px;height:16px;image-rendering:pixelated;background:#fff}
      img.sm{width:32px;height:32px;background:#fff}
      img.md{width:48px;height:48px;background:#fff}
      img.lg{width:96px;height:96px;background:#1e293b;border-radius:12px}
      .note{margin-top:20px;font-size:12px;opacity:.7;max-width:640px}
    </style></head><body>
    <h1>Sales Arena favicon proof (tab-scale → large)</h1>
    <div class="row">
      <figure><img class="ico" src="${BASE}/favicon.ico?v=proof3"><figcaption>/favicon.ico 16px</figcaption></figure>
      <figure><img class="sm" src="${BASE}/favicon.ico?v=proof3"><figcaption>/favicon.ico 32px</figcaption></figure>
      <figure><img class="sm" src="${BASE}/sa-brand-v3-32.png?v=proof3"><figcaption>PNG 32</figcaption></figure>
      <figure><img class="md" src="${BASE}/sa-brand-v3.ico?v=proof3"><figcaption>v3 ICO</figcaption></figure>
      <figure><img class="lg" src="${BASE}/sa-brand-v3.svg?v=proof3"><figcaption>SVG brand</figcaption></figure>
      <figure><img class="sm" src="${BASE}/icon?v=proof3"><figcaption>/icon rewrite</figcaption></figure>
    </div>
    <p class="note">If these render as the dark-blue square + white/blue mark (not a grey globe / broken image), Chrome can use them as tab favicons after cache clear.</p>
  </body></html>`);
  await page.waitForTimeout(1000);
  const proofPath = path.join(OUT, "favicon-tab-proof.png");
  await page.screenshot({ path: proofPath, fullPage: true });

  // Also save raw favicon bytes for inspection
  const icoRes = await context.request.get(BASE + "/favicon.ico", { headers: { "cache-control": "no-cache" } });
  const icoBody = Buffer.from(await icoRes.body());
  fs.writeFileSync(path.join(OUT, "favicon-downloaded.ico"), icoBody);

  const svgRes = await context.request.get(BASE + "/sa-brand-v3.svg");
  fs.writeFileSync(path.join(OUT, "favicon-downloaded.svg"), Buffer.from(await svgRes.body()));

  const report = {
    at: new Date().toISOString(),
    base: BASE,
    htmlIconLinks: hrefs,
    captured: captured.filter((c, i, arr) => arr.findIndex((x) => x.url === c.url && x.status === c.status) === i),
    faviconIco: {
      status: icoRes.status(),
      contentType: icoRes.headers()["content-type"],
      size: icoBody.length,
      magic: icoBody.slice(0, 8).toString("hex"),
      isHtml: looksLikeHtml(icoBody, icoRes.headers()["content-type"]),
      isImage: looksLikeImage(icoBody, icoRes.headers()["content-type"]),
    },
    proofImage: proofPath,
  };
  fs.writeFileSync(path.join(OUT, "favicon-probe-report.json"), JSON.stringify(report, null, 2));

  const bad = report.captured.filter(
    (c) =>
      /favicon|icon|sa-brand|\.ico/i.test(c.url) &&
      !/manifest/i.test(c.url) &&
      (c.isHtml || (!c.isImage && c.status !== 304) || c.status >= 400)
  );
  // /icon as document navigation may be image but Playwright goto might still record ok
  console.log(JSON.stringify(report, null, 2));

  if (!report.faviconIco.isImage || report.faviconIco.isHtml) {
    console.error("FAIL: /favicon.ico is not a brand image");
    process.exit(1);
  }
  const must = ["/favicon.ico", "/sa-brand-v3.svg", "/sa-brand-v3-32.png", "/sa-brand-v3.ico"];
  for (const m of must) {
    const hit = report.captured.find((c) => c.url.includes(m) && c.isImage && !c.isHtml && c.status === 200);
    if (!hit) {
      // fallback: direct request already validated ico; check svg via download
      if (m === "/favicon.ico") continue;
      const r = await context.request.get(BASE + m);
      const b = Buffer.from(await r.body());
      const ct = r.headers()["content-type"] || "";
      if (!(r.status() === 200 && looksLikeImage(b, ct) && !looksLikeHtml(b, ct))) {
        console.error("FAIL missing/bad", m, r.status(), ct, b.slice(0, 16).toString("hex"));
        process.exit(1);
      }
    }
  }

  // /icon must be image not HTML
  const iconR = await context.request.get(BASE + "/icon");
  const iconB = Buffer.from(await iconR.body());
  const iconCt = iconR.headers()["content-type"] || "";
  if (!(iconR.status() === 200 && looksLikeImage(iconB, iconCt) && !looksLikeHtml(iconB, iconCt))) {
    console.error("FAIL /icon", iconR.status(), iconCt, iconB.slice(0, 40).toString("utf8"));
    process.exit(1);
  }

  console.log("PASS favicon checks; proof:", proofPath);
  if (bad.length) {
    console.warn("WARN some icon responses looked bad:", bad);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
