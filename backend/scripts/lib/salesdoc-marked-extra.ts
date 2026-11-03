/** Kassa kartasi balansi va faol xodimning ish joyi. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import type { loadSalesDoc } from "./salesdoc-andijon-load";

const TENANT = 1;

export async function applyCardBalances(
  prisma: PrismaClient,
  root: string,
  clientId: Map<string, number>
): Promise<number> {
  const file = path.join(root, "06-pul", "client-balances.json");
  if (!fs.existsSync(file)) return 0;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
    clients?: Array<{ id?: string; balance?: number }>;
  };
  let written = 0;
  for (const row of parsed.clients ?? []) {
    const code = String(row.id ?? "").slice(0, 32);
    const id = clientId.get(code);
    if (!id || !Number.isFinite(row.balance)) continue;
    const balance = Math.round(Number(row.balance) * 100) / 100;
    await prisma.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: TENANT, client_id: id } },
      create: { tenant_id: TENANT, client_id: id, balance },
      update: { balance }
    });
    written += 1;
  }
  return written;
}

type Person = { id: string; name: string; phone?: string; role: "agent" | "expeditor" | "supervisor" };

export async function openActiveStaff(
  prisma: PrismaClient,
  branch: string,
  warehouseId: number,
  cashDeskId: number,
  data: ReturnType<typeof loadSalesDoc>
) {
  const people: Person[] = [
    ...data.staff.agents.filter((a) => a.active && a.name).map((a) => ({
      id: a.id,
      name: a.name,
      phone: a.phone,
      role: "agent" as const
    })),
    ...data.staff.expeditors.filter((a) => a.name).map((a) => ({
      id: a.id,
      name: a.name,
      role: "expeditor" as const
    })),
    ...data.staff.supervisors.filter((a) => a.name).map((a) => ({
      id: a.id,
      name: a.name,
      role: "supervisor" as const
    }))
  ];
  let users = 0;
  let slots = 0;
  for (const person of people) {
    const role = await prisma.role.upsert({
      where: { tenant_id_key: { tenant_id: TENANT, key: person.role } },
      create: { tenant_id: TENANT, key: person.role, name: person.role, is_system: true },
      update: {}
    });
    const code = `SD-${branch.slice(0, 3)}-${person.role.slice(0, 2)}-${person.id}`.slice(0, 64);
    let user =
      (await prisma.user.findFirst({ where: { tenant_id: TENANT, code } })) ??
      (await prisma.user.findFirst({ where: { tenant_id: TENANT, branch, name: person.name } }));
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenant_id: TENANT,
          name: person.name.slice(0, 200),
          login: `sd-${code}`.toLowerCase().slice(0, 64),
          password_hash: bcrypt.hashSync(crypto.randomBytes(18).toString("base64url"), 8),
          role: person.role === "supervisor" ? "operator" : person.role,
          code,
          branch,
          phone: person.phone || null,
          is_active: true,
          can_authorize: true,
          app_access: true,
          warehouse_id: warehouseId
        }
      });
      users += 1;
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          is_active: true,
          branch,
          warehouse_id: warehouseId,
          phone: user.phone || person.phone || null
        }
      });
    }
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: user.id, role_id: role.id } },
      create: { user_id: user.id, role_id: role.id },
      update: {}
    });
    const linked = await prisma.slotUserLink.findFirst({
      where: { tenant_id: TENANT, user_id: user.id, ended_at: null },
      select: { slot_id: true }
    });
    if (linked) {
      await prisma.workSlot.update({
        where: { id: linked.slot_id },
        data: {
          is_active: true,
          branch_code: branch,
          warehouse_id: warehouseId,
          cash_desk_id: cashDeskId
        }
      });
    } else {
      const slotCode = code.slice(0, 32);
      const slot = await prisma.workSlot.upsert({
        where: { tenant_id_slot_code: { tenant_id: TENANT, slot_code: slotCode } },
        create: {
          tenant_id: TENANT,
          slot_code: slotCode,
          label: person.name.slice(0, 120),
          branch_code: branch,
          branch_codes: [branch],
          slot_type: person.role,
          is_active: true,
          warehouse_id: warehouseId,
          warehouse_ids: [warehouseId],
          cash_desk_id: cashDeskId,
          cash_desk_ids: [cashDeskId]
        },
        update: { is_active: true, warehouse_id: warehouseId, cash_desk_id: cashDeskId, branch_code: branch }
      });
      await prisma.slotUserLink.create({ data: { tenant_id: TENANT, slot_id: slot.id, user_id: user.id } });
    }
    slots += 1;
  }
  return { users, slots };
}
