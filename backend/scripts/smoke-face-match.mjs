/**
 * Lokal smoke A+B: staff etalon yuklash + mobile verify (match/mismatch).
 *   node scripts/smoke-face-match.mjs
 */
import sharp from "sharp";

const API = process.env.API_BASE || "http://127.0.0.1:18080";
const SLUG = process.env.TENANT_SLUG || "test1";
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "secret123";
const AGENT_LOGIN = process.env.AGENT_LOGIN || "agent";
const AGENT_PASSWORD = process.env.AGENT_PASSWORD || "111111";

async function makePhoto(seed) {
  const size = 180;
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[i] = (x * 7 + seed * 13) % 200 + 30;
      raw[i + 1] = (y * 11 + seed * 19) % 180 + 40;
      raw[i + 2] = (x * y + seed * 5) % 160 + 50;
    }
  }
  for (let y = 35; y < 145; y++) {
    for (let x = 45; x < 135; x++) {
      const dx = (x - 90) / 40;
      const dy = (y - 90) / 50;
      if (dx * dx + dy * dy < 1) {
        const i = (y * size + x) * 3;
        raw[i] = Math.min(255, raw[i] + 50 + (seed % 15));
        raw[i + 1] = Math.min(255, raw[i + 1] + 35);
        raw[i + 2] = Math.min(255, raw[i + 2] + 25);
      }
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } })
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** Aniq farqli rasm — mismatch smoke uchun (stripe + qizil blob). */
async function makeMismatchPhoto() {
  const size = 180;
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const v = (x + y) % 20 < 10 ? 20 : 220;
      raw[i] = v;
      raw[i + 1] = 255 - v;
      raw[i + 2] = (x * 3) % 255;
    }
  }
  for (let y = 10; y < 70; y++) {
    for (let x = 110; x < 170; x++) {
      const i = (y * size + x) * 3;
      raw[i] = 255;
      raw[i + 1] = 40;
      raw[i + 2] = 40;
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

async function login(login, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug: SLUG,
      login,
      password,
      device_name: "face-smoke",
      device_id: `face-smoke-${login}`
    })
  });
  const body = await json(res);
  const token = body.accessToken || body.access_token;
  const userId = body.user?.id;
  if (!res.ok || !token) {
    throw new Error(`login ${login} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { token, userId, body };
}

async function main() {
  console.log("API", API);
  const admin = await login(ADMIN_LOGIN, ADMIN_PASSWORD);
  const agent = await login(AGENT_LOGIN, AGENT_PASSWORD);
  console.log("roles", { admin: admin.body.user?.role, agent: agent.body.user?.role, agentId: agent.userId });
  const userId = agent.userId;
  const adminAuth = {
    Authorization: `Bearer ${admin.token}`,
    "Content-Type": "application/json"
  };
  const agentAuth = {
    Authorization: `Bearer ${agent.token}`,
    "Content-Type": "application/json"
  };

  const refBuf = await makePhoto(7);
  const otherBuf = await makeMismatchPhoto();

  const up = await fetch(`${API}/api/${SLUG}/staff/users/${userId}/face-reference`, {
    method: "PUT",
    headers: adminAuth,
    body: JSON.stringify({ image_base64: refBuf.toString("base64") })
  });
  const upBody = await json(up);
  console.log("A staff-upload", up.status, upBody.storage_key ? "OK" : upBody);

  const meta = await fetch(`${API}/api/${SLUG}/staff/users/${userId}/face-meta`, {
    headers: adminAuth
  });
  const metaBody = await json(meta);
  console.log("A face-meta", meta.status, metaBody);

  const ok = await fetch(`${API}/api/${SLUG}/mobile/me/face/verify`, {
    method: "POST",
    headers: agentAuth,
    body: JSON.stringify({
      context: "daily_login",
      image_base64: refBuf.toString("base64")
    })
  });
  const okBody = await json(ok);
  console.log("B match", ok.status, okBody.status, "score=", okBody.score);

  const bad = await fetch(`${API}/api/${SLUG}/mobile/me/face/verify`, {
    method: "POST",
    headers: agentAuth,
    body: JSON.stringify({
      context: "daily_login",
      image_base64: otherBuf.toString("base64")
    })
  });
  const badBody = await json(bad);
  console.log("B mismatch", bad.status, badBody.error || badBody.code || badBody.status, "score=", badBody.score ?? badBody.extras?.score);

  const pass =
    up.ok &&
    metaBody.has_reference === true &&
    ok.ok &&
    okBody.status === "approved" &&
    bad.status === 403;

  console.log(pass ? "SMOKE PASS (A+B)" : "SMOKE FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
