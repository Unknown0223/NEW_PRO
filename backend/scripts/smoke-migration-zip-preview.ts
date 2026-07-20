/**
 * Export backup ZIP then POST preview — diagnose ZIP rejection.
 * Run: npx tsx scripts/smoke-migration-zip-preview.ts
 */
import axios from "axios";
import FormData from "form-data";

const API = process.env.API_BASE ?? "http://127.0.0.1:18080";
const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";
const LOGIN = process.env.IMPORT_LOGIN ?? "admin";
const PASSWORD = process.env.IMPORT_PASSWORD ?? "secret123";

async function main() {
  const login = await axios.post(`${API}/api/auth/login`, {
    slug: TENANT,
    login: LOGIN,
    password: PASSWORD
  });
  const token = login.data.accessToken as string;
  console.log("login ok");

  const exp = await axios.get(`${API}/api/${TENANT}/system-migration/export.backup.zip`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
    validateStatus: () => true,
    maxContentLength: Infinity
  });
  console.log("export", exp.status, "bytes", (exp.data as ArrayBuffer).byteLength, exp.headers["content-type"]);
  if (exp.status !== 200) {
    console.log(Buffer.from(exp.data).toString("utf8").slice(0, 800));
    process.exit(1);
  }

  const zipBuf = Buffer.from(exp.data);

  // Simulate browser axios: Content-Type multipart/form-data WITHOUT boundary (bug)
  const fdBroken = new FormData();
  fdBroken.append("file", zipBuf, {
    filename: `salec-backup-${TENANT}.salec-backup.zip`,
    contentType: "application/zip"
  });
  const brokenHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "multipart/form-data"
  };
  const broken = await axios.post(`${API}/api/${TENANT}/system-migration/import/preview`, fdBroken, {
    headers: brokenHeaders,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });
  console.log("\n--- preview with broken Content-Type (no boundary) ---");
  console.log("status", broken.status, JSON.stringify(broken.data).slice(0, 400));

  // Correct FormData headers (with boundary)
  const fdOk = new FormData();
  fdOk.append("file", zipBuf, {
    filename: `salec-backup-${TENANT}.salec-backup.zip`,
    contentType: "application/zip"
  });
  const ok = await axios.post(`${API}/api/${TENANT}/system-migration/import/preview`, fdOk, {
    headers: { Authorization: `Bearer ${token}`, ...fdOk.getHeaders() },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });
  console.log("\n--- preview with correct multipart boundary ---");
  console.log("status", ok.status);
  console.log(JSON.stringify(ok.data, null, 2).slice(0, 2500));

  // Simulate browser: omit Content-Type entirely (axios interceptor delete)
  const fdOmit = new FormData();
  fdOmit.append("file", zipBuf, {
    filename: `salec-backup-${TENANT}.salec-backup.zip`,
    contentType: "application/zip"
  });
  const { "content-type": _ct, ...rest } = fdOmit.getHeaders();
  const omit = await axios.post(`${API}/api/${TENANT}/system-migration/import/preview`, fdOmit, {
    headers: { Authorization: `Bearer ${token}`, ...rest },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });
  console.log("\n--- preview omitting Content-Type (axios may auto-set) ---");
  console.log("status", omit.status, "valid=", omit.data?.valid);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
