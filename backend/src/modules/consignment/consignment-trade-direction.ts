import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

/** Legacy `users.trade_direction` qiymatlari — katalog qatoriga mos keladigan variantlar. */
export function tradeDirectionLegacyMatchVariants(row: {
  name: string;
  code: string | null;
}): string[] {
  const variants = new Set<string>();
  const name = row.name.trim();
  const code = row.code?.trim() ?? "";
  if (name) variants.add(name);
  if (code) variants.add(code);
  if (name && code) variants.add(`${name} (${code})`);
  return Array.from(variants);
}

/** Agent filtri: `trade_direction_id` yoki eski matn maydoni bo‘yicha. */
export async function userWhereTradeDirection(
  tenantId: number,
  tradeDirectionId: number
): Promise<Prisma.UserWhereInput> {
  const row = await prisma.tradeDirection.findFirst({
    where: { id: tradeDirectionId, tenant_id: tenantId },
    select: { id: true, name: true, code: true }
  });
  if (!row) return { trade_direction_id: tradeDirectionId };

  const or: Prisma.UserWhereInput[] = [{ trade_direction_id: tradeDirectionId }];
  for (const label of tradeDirectionLegacyMatchVariants(row)) {
    or.push({ trade_direction: { equals: label, mode: "insensitive" } });
  }
  return { OR: or };
}
