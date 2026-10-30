/**
 * Andijon ish joylari va xodimlar. Mavjud rol kalitlari qayta yozilmaydi.
 * Yangi loginlarga tasodifiy parol (hisobotga chiqmaydi).
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { loadSalesDoc } from "./salesdoc-andijon-load";

type Bundle = ReturnType<typeof loadSalesDoc>;

const TENANT = 1;
const BRANCH = "Andijon";

async function roleId(prisma: PrismaClient, key: string): Promise<number> {
  const row = await prisma.role.upsert({
    where: { tenant_id_key: { tenant_id: TENANT, key } },
    create: { tenant_id: TENANT, key, name: key, is_system: true },
    update: {}
  });
  return row.id;
}

async function linkRole(prisma: PrismaClient, userId: number, roleKey: string, cache: Map<string, number>) {
  let id = cache.get(roleKey);
  if (!id) {
    id = await roleId(prisma, roleKey);
    cache.set(roleKey, id);
  }
  await prisma.userRole.upsert({
    where: { user_id_role_id: { user_id: userId, role_id: id } },
    create: { user_id: userId, role_id: id },
    update: {}
  });
}

export async function applyAndijonStaff(prisma: PrismaClient, data: Bundle) {
  const stats = {
    usersCreated: 0,
    usersUpdated: 0,
    warehouses: 0,
    cashDesks: 0,
    territories: 0,
    links: 0
  };
  const whMain = await prisma.warehouse.findFirst({
    where: { tenant_id: TENANT, OR: [{ code: "001" }, { name: "Andijon" }] }
  });
  if (!whMain) throw new Error("Andijon ombori (code 001) topilmadi");

  const storeWh = new Map<string, number>();
  storeWh.set("d0_1", whMain.id);
  for (const storeId of data.stores) {
    if (storeId === "d0_1") continue;
    const code = `SD-${storeId}`.slice(0, 40);
    let wh = await prisma.warehouse.findFirst({ where: { tenant_id: TENANT, code } });
    if (!wh) {
      wh = await prisma.warehouse.create({
        data: { tenant_id: TENANT, name: `Andijon ombor ${storeId}`, code, type: "store" }
      });
      stats.warehouses += 1;
    }
    storeWh.set(storeId, wh.id);
  }

  const cashMain = await prisma.cashDesk.findFirst({
    where: { tenant_id: TENANT, name: "Andijon Kassa" }
  });
  if (!cashMain) throw new Error("Andijon Kassa topilmadi");
  const cashByBox = new Map<string, number>();
  cashByBox.set("1", cashMain.id);
  let cash0 = await prisma.cashDesk.findFirst({ where: { tenant_id: TENANT, code: "AND-K0" } });
  if (!cash0) {
    cash0 = await prisma.cashDesk.create({
      data: { tenant_id: TENANT, name: "Andijon kassa 0", code: "AND-K0" }
    });
    stats.cashDesks += 1;
  }
  cashByBox.set("0", cash0.id);

  const territoryId = new Map<string, number>();
  const names = [...new Set(data.clients.map((c) => c.territory.trim()).filter(Boolean))];
  for (const name of names) {
    const code = `AD_${name.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40)}`.slice(0, 64);
    let t = await prisma.territory.findFirst({
      where: { tenant_id: TENANT, deleted_at: null, name: { equals: name, mode: "insensitive" } }
    });
    if (!t) {
      t = await prisma.territory.upsert({
        where: { tenant_id_code: { tenant_id: TENANT, code } },
        create: { tenant_id: TENANT, name, code },
        update: {}
      });
      stats.territories += 1;
    }
    territoryId.set(name.toUpperCase(), t.id);
  }

  const storeName = new Map(data.staff.stores.map((s) => [s.id, s.name]));
  for (const [storeId, whId] of storeWh) {
    const name = storeName.get(storeId);
    if (!name || storeId === "d0_1") continue;
    await prisma.warehouse.update({ where: { id: whId }, data: { name: name.slice(0, 200) } });
  }

  const roles = new Map<string, number>();
  const userByKey = new Map<string, number>();

  async function ensureUser(opts: {
    login: string;
    code: string;
    name: string;
    role: "agent" | "operator" | "expeditor";
    updateName: boolean;
  }): Promise<number> {
    const byCode = await prisma.user.findFirst({ where: { tenant_id: TENANT, code: opts.code } });
    const existing =
      byCode ?? (await prisma.user.findFirst({ where: { tenant_id: TENANT, login: opts.login } }));
    if (existing) {
      if (opts.updateName && existing.name !== opts.name && existing.role !== "admin") {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name: opts.name, code: existing.code ?? opts.code, branch: existing.branch ?? BRANCH }
        });
        stats.usersUpdated += 1;
      }
      await linkRole(prisma, existing.id, opts.role, roles);
      userByKey.set(opts.code, existing.id);
      return existing.id;
    }
    const password_hash = bcrypt.hashSync(crypto.randomBytes(18).toString("base64url"), 8);
    const loginTaken = await prisma.user.findFirst({
      where: { tenant_id: TENANT, login: opts.login },
      select: { id: true }
    });
    const login = loginTaken ? `sd-${opts.code}`.toLowerCase().slice(0, 64) : opts.login;
    const created = await prisma.user.create({
      data: {
        tenant_id: TENANT,
        name: opts.name,
        login,
        password_hash,
        role: opts.role,
        code: opts.code,
        branch: BRANCH,
        can_authorize: true,
        app_access: opts.role === "agent",
        warehouse_id: whMain.id
      }
    });
    stats.usersCreated += 1;
    await linkRole(prisma, created.id, opts.role, roles);
    userByKey.set(opts.code, created.id);
    return created.id;
  }

  const norm = (s: string) =>
    s.toLowerCase().replace(/[''`ʻʼ‘’]/g, "").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const skipUsers = new Set(["d0_19", "d0_67", "d0_86", "d0_91", "d0_92"]);
  const agentByName = new Map(data.staff.agents.map((a) => [norm(a.name), a]));
  const expByName = new Map(data.staff.expeditors.map((a) => [norm(a.name), a]));
  const svById = new Map(data.staff.supervisors.map((a) => [a.id, a]));
  const agentById = new Map(data.staff.agents.map((a) => [a.id, a]));

  const people = data.staff.users.filter((u) => !skipUsers.has(u.id));
  const kept = new Map<string, number>();

  async function absorb(dropId: number, keepId: number) {
    if (dropId === keepId) return;
    await prisma.$executeRaw`UPDATE orders SET agent_id = ${keepId} WHERE agent_id = ${dropId} AND id <> 868 AND tenant_id = ${TENANT}`;
    await prisma.$executeRaw`UPDATE orders SET expeditor_user_id = ${keepId} WHERE expeditor_user_id = ${dropId} AND id <> 868 AND tenant_id = ${TENANT}`;
    await prisma.$executeRaw`UPDATE client_payments SET created_by_user_id = ${keepId} WHERE created_by_user_id = ${dropId} AND tenant_id = ${TENANT} AND (order_id IS NULL OR order_id <> 868)`;
    await prisma.$executeRaw`UPDATE client_payments SET ledger_agent_id = ${keepId} WHERE ledger_agent_id = ${dropId} AND tenant_id = ${TENANT} AND (order_id IS NULL OR order_id <> 868)`;
    await prisma.$executeRaw`UPDATE clients SET agent_id = ${keepId} WHERE agent_id = ${dropId} AND tenant_id = ${TENANT}`;
    await prisma.$executeRaw`UPDATE users SET supervisor_user_id = ${keepId} WHERE supervisor_user_id = ${dropId} AND tenant_id = ${TENANT} AND id <> ${keepId}`;
    await prisma.$executeRaw`DELETE FROM user_roles a USING user_roles b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.role_id = b.role_id`;
    await prisma.$executeRaw`UPDATE user_roles SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM warehouse_user_links a USING warehouse_user_links b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.warehouse_id = b.warehouse_id`;
    await prisma.$executeRaw`UPDATE warehouse_user_links SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM cash_desk_user_links a USING cash_desk_user_links b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.cash_desk_id = b.cash_desk_id`;
    await prisma.$executeRaw`UPDATE cash_desk_user_links SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM user_branches a USING user_branches b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.branch_code = b.branch_code AND a.tenant_id = b.tenant_id`;
    await prisma.$executeRaw`UPDATE user_branches SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM user_payment_methods a USING user_payment_methods b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.payment_method = b.payment_method AND a.tenant_id = b.tenant_id`;
    await prisma.$executeRaw`UPDATE user_payment_methods SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM territory_user_links a USING territory_user_links b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.territory_id = b.territory_id`;
    await prisma.$executeRaw`UPDATE territory_user_links SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.$executeRaw`DELETE FROM slot_user_links a USING slot_user_links b WHERE a.user_id = ${dropId} AND b.user_id = ${keepId} AND a.slot_id = b.slot_id AND a.ended_at IS NULL AND b.ended_at IS NULL`;
    await prisma.$executeRaw`UPDATE slot_user_links SET user_id = ${keepId} WHERE user_id = ${dropId}`;
    await prisma.user.delete({ where: { id: dropId } });
    stats.usersUpdated += 1;
  }

  const natives = await prisma.user.findMany({
    where: { tenant_id: TENANT, role: { not: "admin" }, OR: [{ branch: BRANCH }, { code: { startsWith: "PMAND" } }, { code: { startsWith: "ANEX" } }] },
    select: { id: true, name: true, code: true, role: true, branch: true }
  });
  const nativeByName = new Map<string, number>();
  for (const u of natives) {
    if (u.code?.startsWith("SD")) continue;
    const k = norm(u.name);
    if (!nativeByName.has(k)) nativeByName.set(k, u.id);
  }

  for (const person of people) {
    const agent = agentByName.get(norm(person.name));
    const exp = expByName.get(norm(person.name));
    const sv = svById.get(person.id);
    const role: "agent" | "expeditor" | "supervisor" | "operator" = sv ? "supervisor" : agent ? "agent" : exp ? "expeditor" : "operator";
    const code = `SDU-${person.id}`;
    const nativeId = nativeByName.get(norm(person.name)) ?? null;
    const placeholders = [
      agent ? `SDAG-${agent.id}` : "",
      exp ? `SDEX-${exp.id}` : "",
      `SDOP-${person.id}`,
      code
    ].filter(Boolean);
    const phRows = await prisma.user.findMany({
      where: { tenant_id: TENANT, code: { in: placeholders } },
      select: { id: true, code: true }
    });
    const keepId = nativeId ?? phRows.find((r) => r.code === code)?.id ?? phRows[0]?.id ?? 0;
    let id = keepId;
    if (!id) {
      id = await ensureUser({ login: code.toLowerCase(), code, name: person.name, role, updateName: true });
      await prisma.user.update({
        where: { id },
        data: {
          agent_type: agent?.kind?.slice(0, 64) || null,
          phone: agent?.phone || null,
          is_active: agent ? agent.active : true,
          filter_visible: agent ? !agent.active : false
        }
      });
    } else {
      const row = await prisma.user.findFirst({ where: { id }, select: { code: true, phone: true, role: true } });
      const keepCode = row?.code && !row.code.startsWith("SD") ? row.code : code;
      await prisma.user.update({
        where: { id },
        data: {
          name: person.name,
          code: keepCode,
          role: row?.role === "admin" ? row.role : role,
          branch: BRANCH,
          agent_type: agent?.kind?.slice(0, 64) || null,
          phone: row?.phone || agent?.phone || null,
          is_active: agent ? agent.active : true,
          filter_visible: agent ? !agent.active : false,
          warehouse_id: whMain.id
        }
      });
      await linkRole(prisma, id, role, roles);
      userByKey.set(keepCode, id);
      stats.usersUpdated += 1;
    }
    for (const row of phRows) {
      if (row.id !== id) await absorb(row.id, id);
    }
    kept.set(person.id, id);
    if (agent) userByKey.set(`AG-${agent.id}`, id);
    if (exp) userByKey.set(`EX-${exp.id}`, id);
    userByKey.set(`US-${person.id}`, id);
    if (agent?.active && agent.code) userByKey.set(agent.code, id);
    await prisma.userBranchLink.upsert({
      where: { tenant_id_user_id_branch_code: { tenant_id: TENANT, user_id: id, branch_code: BRANCH } },
      create: { tenant_id: TENANT, user_id: id, branch_code: BRANCH },
      update: {}
    });
    const slotCode = `SDU-${person.id}`.slice(0, 32);
    const slot = await prisma.workSlot.upsert({
      where: { tenant_id_slot_code: { tenant_id: TENANT, slot_code: slotCode } },
      create: {
        tenant_id: TENANT,
        slot_code: slotCode,
        label: person.name.slice(0, 120),
        branch_code: BRANCH,
        branch_codes: [BRANCH],
        slot_type: role,
        warehouse_id: whMain.id,
        warehouse_ids: [whMain.id]
      },
      update: { label: person.name.slice(0, 120), slot_type: role }
    });
    const open = await prisma.slotUserLink.findFirst({
      where: { tenant_id: TENANT, slot_id: slot.id, user_id: id, ended_at: null }
    });
    if (!open) await prisma.slotUserLink.create({ data: { tenant_id: TENANT, slot_id: slot.id, user_id: id } });
    if (role === "agent" || role === "expeditor") {
      await prisma.warehouseUserLink.upsert({
        where: { warehouse_id_user_id: { warehouse_id: whMain.id, user_id: id } },
        create: { warehouse_id: whMain.id, user_id: id, link_role: role },
        update: {}
      });
    }
    stats.links += 1;
  }

  for (const sv of data.staff.supervisors) {
    const sid = kept.get(sv.id);
    if (!sid) continue;
    for (const agentId of sv.agents) {
      const agent = agentById.get(agentId);
      const uid = agent ? userByKey.get(`AG-${agent.id}`) : undefined;
      if (!uid) continue;
      await prisma.user.update({ where: { id: uid }, data: { supervisor_user_id: sid } });
      stats.links += 1;
    }
  }

  for (const [userId, boxes] of data.operators) {
    const id = kept.get(userId);
    if (!id) continue;
    let best = "1";
    let n = -1;
    for (const [box, c] of boxes) {
      if (c > n) {
        best = box;
        n = c;
      }
    }
    const deskId = cashByBox.get(best) ?? cashMain.id;
    await prisma.cashDeskUserLink.upsert({
      where: { cash_desk_id_user_id: { cash_desk_id: deskId, user_id: id } },
      create: { cash_desk_id: deskId, user_id: id, link_role: "operator" },
      update: {}
    });
    await prisma.userPaymentMethodLink.upsert({
      where: { tenant_id_user_id_payment_method: { tenant_id: TENANT, user_id: id, payment_method: "001" } },
      create: { tenant_id: TENANT, user_id: id, payment_method: "001" },
      update: {}
    });
    stats.links += 1;
  }

  const agentTerr = new Map<string, Set<string>>();
  for (const c of data.clients) {
    if (!c.agentCode || !c.territory) continue;
    const set = agentTerr.get(c.agentCode) ?? new Set<string>();
    set.add(c.territory.toUpperCase());
    agentTerr.set(c.agentCode, set);
  }
  for (const [code, set] of agentTerr) {
    const uid = userByKey.get(code);
    if (!uid) continue;
    for (const terr of set) {
      const tid = territoryId.get(terr);
      if (!tid) continue;
      await prisma.territoryUserLink.upsert({
        where: { territory_id_user_id: { territory_id: tid, user_id: uid } },
        create: { territory_id: tid, user_id: uid },
        update: {}
      });
      stats.links += 1;
    }
  }

  return { stats, storeWh, cashByBox, userByKey, whMainId: whMain.id, cashMainId: cashMain.id };
}
