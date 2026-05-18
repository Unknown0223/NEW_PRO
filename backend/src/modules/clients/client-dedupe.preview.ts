import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientDedupePreviewDto } from "./client-dedupe.types";
import { formatBalanceUZS, formatContactPersonsSummary, formatMoneyUZS } from "./client-dedupe.helpers";

type PreviewAgg = {
  orders_total: number;
  orders_open: number;
  orders_cancelled: number;
  bonus_sum: Prisma.Decimal;
};

function toPreviewDto(
  c: {
    id: number;
    name: string;
    legal_name: string | null;
    phone: string | null;
    inn: string | null;
    client_pinfl: string | null;
    contract_number: string | null;
    address: string | null;
    zone: string | null;
    region: string | null;
    city: string | null;
    category: string | null;
    landmark: string | null;
    client_code: string | null;
    is_active: boolean;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
    updated_at: Date;
    client_balances: { balance: Prisma.Decimal }[];
    sales_channel: string | null;
    client_format: string | null;
    client_type_code: string | null;
    responsible_person: string | null;
    bank_name: string | null;
    bank_account: string | null;
    bank_mfo: string | null;
    oked: string | null;
    vat_reg_code: string | null;
    notes: string | null;
    credit_limit: Prisma.Decimal;
    product_category_ref: string | null;
    contact_persons: Prisma.JsonValue;
    agent_assignments: Array<{
      slot: number;
      agent: { name: string } | null;
      expeditor_user: { name: string } | null;
      expeditor_phone: string | null;
    }>;
  },
  agg: PreviewAgg | undefined,
  equipmentCount: number
): ClientDedupePreviewDto {
  const bal = c.client_balances[0]?.balance;
  const a = agg ?? {
    orders_total: 0,
    orders_open: 0,
    orders_cancelled: 0,
    bonus_sum: new Prisma.Decimal(0)
  };
  return {
    id: c.id,
    name: c.name,
    legal_name: c.legal_name,
    phone: c.phone,
    inn: c.inn,
    client_pinfl: c.client_pinfl,
    contract_number: c.contract_number,
    address: c.address,
    zone: c.zone,
    region: c.region,
    city: c.city,
    category: c.category,
    landmark: c.landmark,
    client_code: c.client_code,
    is_active: c.is_active,
    latitude: c.latitude != null ? String(c.latitude) : null,
    longitude: c.longitude != null ? String(c.longitude) : null,
    updated_at: c.updated_at.toISOString(),
    balance: formatBalanceUZS(bal),
    sales_channel: c.sales_channel,
    client_format: c.client_format,
    client_type_code: c.client_type_code,
    responsible_person: c.responsible_person,
    bank_name: c.bank_name,
    bank_account: c.bank_account,
    bank_mfo: c.bank_mfo,
    oked: c.oked,
    vat_reg_code: c.vat_reg_code,
    notes: c.notes,
    credit_limit: formatMoneyUZS(c.credit_limit, true),
    product_category_ref: c.product_category_ref,
    contact_summary: formatContactPersonsSummary(c.contact_persons),
    orders_total: a.orders_total,
    orders_open: a.orders_open,
    orders_cancelled: a.orders_cancelled,
    orders_bonus_sum: formatMoneyUZS(a.bonus_sum, true),
    equipment_count: equipmentCount,
    team_lines: c.agent_assignments
      .slice()
      .sort((x, y) => x.slot - y.slot)
      .slice(0, 5)
      .map((a) => {
        const team = `Команда ${a.slot}`;
        const agent = a.agent?.name?.trim() || "—";
        const exp = a.expeditor_user?.name?.trim() || a.expeditor_phone?.trim() || "—";
        return `${team}|${agent}|${exp}`;
      })
  };
}

export async function loadClientPreviewsMap(
  tenantId: number,
  ids: number[]
): Promise<Map<number, ClientDedupePreviewDto>> {
  const uniq = [...new Set(ids)].filter((x) => Number.isFinite(x) && x > 0);
  const m = new Map<number, ClientDedupePreviewDto>();
  if (uniq.length === 0) return m;

  type OrderAggRow = {
    client_id: number;
    orders_total: number;
    orders_open: number;
    orders_cancelled: number;
    bonus_sum: Prisma.Decimal;
  };

  const [rows, orderAggRows, equipGroups] = await Promise.all([
    prisma.client.findMany({
      where: { tenant_id: tenantId, id: { in: uniq } },
      select: {
        id: true,
        name: true,
        legal_name: true,
        phone: true,
        inn: true,
        client_pinfl: true,
        contract_number: true,
        address: true,
        zone: true,
        region: true,
        city: true,
        category: true,
        landmark: true,
        client_code: true,
        is_active: true,
        latitude: true,
        longitude: true,
        updated_at: true,
        client_balances: { select: { balance: true }, take: 1 },
        sales_channel: true,
        client_format: true,
        client_type_code: true,
        responsible_person: true,
        bank_name: true,
        bank_account: true,
        bank_mfo: true,
        oked: true,
        vat_reg_code: true,
        notes: true,
        credit_limit: true,
        product_category_ref: true,
        contact_persons: true,
        agent_assignments: {
          select: {
            slot: true,
            expeditor_phone: true,
            agent: { select: { name: true } },
            expeditor_user: { select: { name: true } }
          }
        }
      }
    }),
    prisma.$queryRaw<OrderAggRow[]>(Prisma.sql`
      SELECT o.client_id::int AS "client_id",
        COUNT(*)::int AS "orders_total",
        COUNT(*) FILTER (WHERE o.status NOT IN ('delivered','cancelled','returned'))::int AS "orders_open",
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS "orders_cancelled",
        COALESCE(SUM(o.bonus_sum), 0)::decimal AS "bonus_sum"
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.client_id IN (${Prisma.join(uniq.map((i) => Prisma.sql`${i}`))})
      GROUP BY o.client_id
    `),
    prisma.clientEquipment.groupBy({
      by: ["client_id"],
      where: { tenant_id: tenantId, client_id: { in: uniq }, removed_at: null },
      _count: { _all: true }
    })
  ]);

  const orderMap = new Map<number, PreviewAgg>();
  for (const r of orderAggRows) {
    orderMap.set(r.client_id, {
      orders_total: r.orders_total,
      orders_open: r.orders_open,
      orders_cancelled: r.orders_cancelled,
      bonus_sum: r.bonus_sum
    });
  }

  const equipMap = new Map<number, number>();
  for (const g of equipGroups) {
    equipMap.set(g.client_id, g._count._all);
  }

  for (const c of rows) {
    m.set(
      c.id,
      toPreviewDto(c, orderMap.get(c.id), equipMap.get(c.id) ?? 0)
    );
  }
  return m;
}
