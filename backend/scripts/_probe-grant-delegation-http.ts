import axios from "axios";
import { prisma } from "../src/config/database";

async function main() {
  const base = "http://127.0.0.1:18080";
  const admin = await prisma.user.findFirst({
    where: { tenant_id: 1, role: "admin", is_active: true },
    select: { id: true, login: true }
  });
  if (!admin?.login) {
    console.log("no admin");
    return;
  }

  const loginRes = await axios.post(`${base}/auth/login`, {
    login: admin.login,
    password: "secret123",
    slug: "test1"
  });
  const token = loginRes.data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };

  const detail1 = await axios.get(`${base}/api/test1/access/users/2090/detail`, { headers });
  const d1 = detail1.data.data as {
    grant_delegation_operation_keys?: string[];
    matrix: { key: string; can_grant_others?: boolean; effective?: boolean }[];
  };
  const eff1 = d1.matrix.filter((r) => r.effective);
  const grantKeys1 = d1.grant_delegation_operation_keys ?? [];
  console.log("detail has grant_delegation_operation_keys", grantKeys1.length > 0, "count", grantKeys1.length);
  console.log("matrix effective", eff1.length, "can_grant on rows", eff1.filter((r) => r.can_grant_others).length);
  const sample = eff1[0];
  if (sample) console.log("sample", sample.key, "can_grant_others field", sample.can_grant_others);

  const testKey = eff1.find((r) => r.key.includes("audit"))?.key ?? eff1[0]?.key;
  if (!testKey) return;

  await axios.patch(
    `${base}/api/test1/access/users/2090`,
    { grant_delegation_revoke: [testKey] },
    { headers }
  );

  const detail2 = await axios.get(`${base}/api/test1/access/users/2090/detail`, { headers });
  const d2 = detail2.data.data as typeof d1;
  const row2 = d2.matrix.find((r) => r.key === testKey);
  const inList2 = (d2.grant_delegation_operation_keys ?? []).includes(testKey);
  console.log("after revoke", testKey, "can_grant_others", row2?.can_grant_others, "in list", inList2);

  await axios.patch(
    `${base}/api/test1/access/users/2090`,
    { grant_delegation_allow: ["audit.log.view"] },
    { headers }
  );
  const detail4 = await axios.get(`${base}/api/test1/access/users/2090/detail`, { headers });
  console.log("PATCH grant_delegation_allow accepted, keys in response", (detail4.data.data.grant_delegation_operation_keys ?? []).length);
  console.log("body keys sample", Object.keys(detail4.data.data));
}

main()
  .catch((e) => {
    if (axios.isAxiosError(e)) {
      console.error("HTTP", e.response?.status, e.response?.data);
    } else {
      console.error(e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
