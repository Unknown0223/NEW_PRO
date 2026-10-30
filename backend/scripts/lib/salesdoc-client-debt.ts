/**
 * SalesDoc «Отчет по дебиторской задолженности» (client-debt.json).
 * total_debt musbat qarz. Kartada qarz manfiy, shuning uchun balans = -qarz.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { PrismaClient } from "@prisma/client";

const TENANT = 1;

export async function applyClientDebtFile(
  prisma: PrismaClient,
  root: string,
  warehouseId?: number
): Promise<number> {
  const file = path.join(root, "06-pul", "client-debt.json");
  if (!fs.existsSync(file)) return 0;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
    clients?: Array<{ customer_id?: string; total_debt?: string }>;
  };
  const rows = parsed.clients ?? [];
  let written = 0;
  for (const row of rows) {
    const code = String(row.customer_id ?? "").slice(0, 32);
    const debt = Number(row.total_debt ?? 0);
    if (!code || !Number.isFinite(debt)) continue;
    const client = await prisma.client.findFirst({
      where: {
        tenant_id: TENANT,
        client_code: code,
        ...(warehouseId ? { warehouse_id: warehouseId } : {})
      },
      select: { id: true }
    });
    if (!client) continue;
    const balance = Math.round(-debt * 100) / 100;
    await prisma.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: TENANT, client_id: client.id } },
      create: { tenant_id: TENANT, client_id: client.id, balance },
      update: { balance }
    });
    written += 1;
  }
  return written;
}
