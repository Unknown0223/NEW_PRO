/**
 * Lokal: har bir roldan 1 hodim + work-slot bog‘lanishlari + mirror tekshiruv.
 *
 *   npx tsx scripts/local-one-per-role-workslots.ts
 *   npx tsx scripts/local-one-per-role-workslots.ts --http   # API 18080 da ishlayotganda access smoke
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createStaff } from "../src/modules/staff/staff.crud.create";
import type { CreateStaffInput, StaffKind } from "../src/modules/staff/staff.shared";
import { syncTenantUserRolesFromProfile } from "../src/modules/access/rbac.roles";
import { ensureRoleByKey } from "../src/modules/access/rbac.roles";
import { setRolePermissions } from "../src/modules/access/rbac.permissions";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";
import { createWorkSlot, patchWorkSlot } from "../src/modules/work-slots/work-slots.service";
import { assignUserToSlot } from "../src/modules/work-slots/work-slots.assign";
import {
  SLOT_TYPE_CODE_PREFIX,
  WORK_SLOT_TYPES,
  type WorkSlotType
} from "../src/modules/work-slots/work-slots.constants";
import { WEB_PANEL_DENIED_ROLES } from "../src/lib/tenant-user-roles";

const prisma = new PrismaClient();
const TENANT_SLUG = process.env.IMPORT_TENANT_SLUG?.trim() || "test1";
const PASSWORD = "Test1234!";
const LOGIN_PREFIX = "local_one_";
const API = process.env.LOCAL_API_URL?.trim() || "http://127.0.0.1:18080";

const ROLE_SPECS: Array<{ kind: StaffKind; slotType: WorkSlotType }> = WORK_SLOT_TYPES.map((t) => ({
  kind: t as StaffKind,
  slotType: t
}));

function loginFor(role: string) {
  return `${LOGIN_PREFIX}${role}`;
}

async function ensureUser(tenantId: number, kind: StaffKind, warehouseId: number | null): Promise<{
  id: number;
  login: string;
  created: boolean;
}> {
  const login = loginFor(kind);
  const existing = await prisma.user.findFirst({
    where: { tenant_id: tenantId, login },
    select: { id: true }
  });
  if (existing) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password_hash: hash,
        is_active: true,
        can_authorize: true,
        app_access: true,
        role: kind,
        max_sessions: 10
      }
    });
    return { id: existing.id, login, created: false };
  }

  const input: CreateStaffInput = {
    first_name: "Local",
    last_name: kind,
    middle_name: null,
    login,
    password: PASSWORD,
    phone: null,
    code: `L1-${kind.slice(0, 6).toUpperCase()}`.slice(0, 20),
    pinfl: null,
    branch: "LOCAL",
    position: `Local ${kind}`,
    can_authorize: true,
    app_access: true,
    max_sessions: 10,
    warehouse_ids: warehouseId != null && kind === "skladchik" ? [warehouseId] : undefined,
    warehouse_id: warehouseId != null && kind !== "skladchik" ? warehouseId : undefined
  };

  const row = await createStaff(tenantId, kind, input, null);
  return { id: row.id, login, created: true };
}

async function ensureSlotAndAssign(
  tenantId: number,
  slotType: WorkSlotType,
  userId: number,
  warehouseId: number | null,
  cashDeskId: number | null
) {
  const prefix = SLOT_TYPE_CODE_PREFIX[slotType];
  const code = `${prefix}-L1`.slice(0, 32);
  let slot = await prisma.workSlot.findFirst({
    where: { tenant_id: tenantId, slot_code: code },
    select: { id: true }
  });
  if (!slot) {
    const created = await createWorkSlot(tenantId, {
      slot_code: code,
      label: `Local one ${slotType}`,
      slot_type: slotType,
      is_active: true
    });
    slot = { id: created.id };
  }

  await patchWorkSlot(tenantId, slot.id, {
    territory_zones: ["LOCAL-ZONE"],
    territory_oblasts: ["LOCAL-OBLAST"],
    territory_cities: ["LOCAL-CITY"],
    warehouse_ids: warehouseId != null ? [warehouseId] : [],
    cash_desk_ids: cashDeskId != null ? [cashDeskId] : [],
    price_type: "default"
  });

  await assignUserToSlot(tenantId, slot.id, userId, null, "local one-per-role");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      territory: true,
      warehouse_id: true,
      price_type: true,
      warehouse_links: { select: { warehouse_id: true } },
      cash_desk_links: { select: { cash_desk_id: true } }
    }
  });
  const link = await prisma.slotUserLink.findFirst({
    where: { slot_id: slot.id, user_id: userId, ended_at: null },
    select: { id: true }
  });

  const okLink = Boolean(link);
  const okTerr =
    Boolean(user?.territory?.includes("LOCAL-ZONE")) ||
    Boolean(user?.territory?.includes("LOCAL-CITY"));
  const okWh =
    warehouseId == null ||
    user?.warehouse_id === warehouseId ||
    (user?.warehouse_links ?? []).some((l) => l.warehouse_id === warehouseId);

  return {
    slotId: slot.id,
    slotCode: code,
    okLink,
    okTerr,
    okWh,
    territory: user?.territory ?? null,
    warehouse_id: user?.warehouse_id ?? null,
    cash_desks: (user?.cash_desk_links ?? []).map((l) => l.cash_desk_id)
  };
}

async function httpSmoke(accounts: Array<{ role: string; login: string; id?: number }>) {
  console.log(`\n── HTTP access smoke (${API}) ──`);
  const denied = new Set(WEB_PANEL_DENIED_ROLES as readonly string[]);

  // Local smoke: eski refresh sessiyalarni tozalash (max_sessions=1 qoldiqlari).
  const localIds = (
    await prisma.user.findMany({
      where: { login: { startsWith: LOGIN_PREFIX } },
      select: { id: true }
    })
  ).map((u) => u.id);
  if (localIds.length) {
    await prisma.user.updateMany({ where: { id: { in: localIds } }, data: { max_sessions: 10 } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: localIds } } });
  }

  for (const a of accounts) {
    const expectWebDenied = denied.has(a.role);
    const deviceId = `smoke-${a.role}-${Date.now()}`;
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:3000",
        "user-agent": "Mozilla/5.0 local-smoke"
      },
      body: JSON.stringify({
        slug: TENANT_SLUG,
        login: a.login,
        password: PASSWORD,
        device_id: deviceId,
        device_name: "local-smoke"
      })
    });
    const loginBody = (await loginRes.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
      code?: string;
      message?: string;
    };

    if (expectWebDenied) {
      const ok =
        loginRes.status === 403 &&
        (loginBody.code === "WEB_ACCESS_DENIED" || /мобил|mobil/i.test(loginBody.message ?? ""));
      console.log(`${ok ? "✓" : "✗"} ${a.role} web-login → ${loginRes.status} (kutilgan WEB_ACCESS_DENIED)`);
      continue;
    }

    if (!loginRes.ok || !loginBody.accessToken) {
      console.log(`✗ ${a.role} login → ${loginRes.status} ${loginBody.code ?? loginBody.message ?? ""}`);
      continue;
    }

    const slotsRes = await fetch(`${API}/api/${TENANT_SLUG}/work-slots?limit=5`, {
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
        origin: "http://127.0.0.1:3000",
        "user-agent": "Mozilla/5.0 local-smoke"
      }
    });
    const allowedByPreset = [
      "operator",
      "supervisor",
      "director",
      "sales_director",
      "manager"
    ].includes(a.role);
    const ok =
      (allowedByPreset && slotsRes.status === 200) ||
      (!allowedByPreset && (slotsRes.status === 403 || slotsRes.status === 200));
    console.log(
      `${ok ? "✓" : "✗"} ${a.role} GET /work-slots → ${slotsRes.status}` +
        (allowedByPreset ? " (view kutilgan)" : " (deny yoki view)")
    );

    if (loginBody.refreshToken) {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${loginBody.accessToken}` },
        body: JSON.stringify({ refreshToken: loginBody.refreshToken })
      }).catch(() => undefined);
    }
  }

  // admin seed
  const adminLogin = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:3000",
      "user-agent": "Mozilla/5.0 local-smoke"
    },
    body: JSON.stringify({ slug: TENANT_SLUG, login: "admin", password: "secret123" })
  });
  const adminBody = (await adminLogin.json().catch(() => ({}))) as { accessToken?: string };
  if (adminBody.accessToken) {
    const r = await fetch(`${API}/api/${TENANT_SLUG}/work-slots?limit=5`, {
      headers: { authorization: `Bearer ${adminBody.accessToken}` }
    });
    console.log(`${r.status === 200 ? "✓" : "✗"} admin GET /work-slots → ${r.status}`);
  } else {
    console.log(`✗ admin login → ${adminLogin.status}`);
  }
}

async function main() {
  const doHttp = process.argv.includes("--http");
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${TENANT_SLUG}`);

  const warehouse = await prisma.warehouse.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { id: "asc" }
  });
  const cashDesk = await prisma.cashDesk.findFirst({
    where: { tenant_id: tenant.id, is_active: true },
    orderBy: { id: "asc" }
  });

  console.log(`\n=== Local one-per-role work-slots (tenant=${TENANT_SLUG}) ===`);
  console.log(`password: ${PASSWORD}`);

  const accounts: Array<{ role: string; login: string }> = [];

  for (const spec of ROLE_SPECS) {
    const keys = buildRoleDefaultKeys(spec.kind);
    if (keys.length > 0) {
      const role = await ensureRoleByKey(tenant.id, spec.kind);
      await setRolePermissions(tenant.id, role.id, keys);
    }

    const user = await ensureUser(tenant.id, spec.kind, warehouse?.id ?? null);
    accounts.push({ role: spec.kind, login: user.login });

    const bind = await ensureSlotAndAssign(
      tenant.id,
      spec.slotType,
      user.id,
      warehouse?.id ?? null,
      cashDesk?.id ?? null
    );

    const ok = bind.okLink && bind.okTerr && bind.okWh;
    console.log(
      `${ok ? "✓" : "✗"} ${spec.kind}: ${user.login} → slot ${bind.slotCode} (#${bind.slotId})` +
        ` link=${bind.okLink} terr=${bind.okTerr} wh=${bind.okWh}` +
        (user.created ? " [created]" : " [updated]")
    );
    if (!ok) {
      console.log(`   territory=${bind.territory} warehouse_id=${bind.warehouse_id} cash=${bind.cash_desks.join(",")}`);
    }
  }

  await syncTenantUserRolesFromProfile(tenant.id);
  console.log("\nRBAC user↔role sync OK");
  console.log("\nKirish (veb, company=test1):");
  for (const a of accounts) {
    const web = (WEB_PANEL_DENIED_ROLES as readonly string[]).includes(a.role)
      ? "faqat mobil"
      : "veb OK";
    console.log(`  ${a.login} / ${PASSWORD}  (${a.role}, ${web})`);
  }
  console.log(`  admin / secret123  (admin)`);
  console.log(`  operator / secret123  (operator seed)`);
  console.log(`  supervisor / secret123  (supervisor seed)`);

  if (doHttp) {
    await httpSmoke(accounts);
  } else {
    console.log("\nAPI ishlagach: npx tsx scripts/local-one-per-role-workslots.ts --http");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
