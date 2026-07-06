import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import type { ClientBalanceListQuery } from "./client-balances.types";
import { parseIsoDateStartUtc, parseIsoDateEndUtc } from "./client-balances.date";
import {
  isExternalClientCode,
  parseExternalClientCodeSuffix
} from "../../../shared/client-display-id";

/** Balanslar ro‘yxati: `search` — tashqi kod, aniq id yoki matn. */
export function buildClientBalanceSearchOrClause(searchRaw: string): Prisma.ClientWhereInput[] {
  const search = searchRaw.trim();
  if (!search) return [];

  const ins = "insensitive" as const;

  if (isExternalClientCode(search)) {
    const suffixId = parseExternalClientCodeSuffix(search);
    const parts: Prisma.ClientWhereInput[] = [
      { client_code: { equals: search, mode: ins } }
    ];
    if (suffixId != null) parts.push({ id: suffixId });
    return parts;
  }

  const idDigits = search.replace(/\s+/g, "");
  if (/^\d+$/.test(idDigits)) {
    const idNum = Number.parseInt(idDigits, 10);
    if (Number.isFinite(idNum) && idNum > 0) {
      const parts: Prisma.ClientWhereInput[] = [
        { client_code: { equals: search, mode: ins } }
      ];
      if (idDigits === String(idNum)) {
        parts.unshift({ id: idNum });
      }
      return parts;
    }
  }

  return [
    { name: { contains: search, mode: ins } },
    { phone: { contains: search, mode: ins } },
    { client_code: { contains: search, mode: ins } },
    { inn: { contains: search, mode: ins } }
  ];
}

export function buildClientWhere(
  tenantId: number,
  q: ClientBalanceListQuery,
  opts?: { skipBalanceFilter?: boolean; skipTerritoryFilters?: boolean }
): Prisma.ClientWhereInput {
  const andParts: Prisma.ClientWhereInput[] = [
    { tenant_id: tenantId },
    { merged_into_client_id: null }
  ];

  const sts =
    q.statuses?.filter((x) => x === "active" || x === "inactive") ??
    (q.status?.trim() === "active" || q.status?.trim() === "inactive" ? [q.status.trim()] : []);
  if (sts.length === 1) {
    const st = sts[0]!;
    if (st === "active") andParts.push({ is_active: true });
    else if (st === "inactive") {
      andParts.push({ is_active: false });
      andParts.push({
        OR: [
          { client_balances: { some: { balance: { lt: 0 } } } },
          { client_balances: { some: { balance: { gt: 0 } } } }
        ]
      });
    }
  } else if (sts.length >= 2) {
    const hasActive = sts.includes("active");
    const hasInactive = sts.includes("inactive");
    if (hasActive && !hasInactive) andParts.push({ is_active: true });
    else if (hasInactive && !hasActive) {
      andParts.push({ is_active: false });
      andParts.push({
        OR: [
          { client_balances: { some: { balance: { lt: 0 } } } },
          { client_balances: { some: { balance: { gt: 0 } } } }
        ]
      });
    }
  }

  if (q.agent_ids?.length) {
    andParts.push({
      OR: q.agent_ids.flatMap((aid) => [
        { agent_id: aid },
        { agent_assignments: { some: { agent_id: aid } } }
      ])
    });
  } else if (q.agent_id != null && q.agent_id > 0) {
    const aid = q.agent_id;
    andParts.push({
      OR: [{ agent_id: aid }, { agent_assignments: { some: { agent_id: aid } } }]
    });
  }

  if (q.expeditor_user_ids?.length) {
    andParts.push({
      OR: q.expeditor_user_ids.flatMap((ex) => [
        { orders: { some: { expeditor_user_id: ex } } },
        { payments: { some: { expeditor_user_id: ex } } }
      ])
    });
  } else if (q.expeditor_user_id != null && q.expeditor_user_id > 0) {
    const ex = q.expeditor_user_id;
    andParts.push({
      OR: [
        { orders: { some: { expeditor_user_id: ex } } },
        { payments: { some: { expeditor_user_id: ex } } }
      ]
    });
  }

  if (q.supervisor_user_ids?.length) {
    andParts.push({ agent: { supervisor_user_id: { in: q.supervisor_user_ids } } });
  } else if (q.supervisor_user_id != null && q.supervisor_user_id > 0) {
    andParts.push({ agent: { supervisor_user_id: q.supervisor_user_id } });
  }

  const tds = q.trade_directions?.filter((x) => x.trim() !== "") ?? [];
  if (tds.length > 0) {
    andParts.push({
      OR: tds.map((td) => ({
        agent: {
          OR: [
            { trade_direction: { contains: td, mode: "insensitive" } },
            { trade_direction_row: { name: { contains: td, mode: "insensitive" } } }
          ]
        }
      }))
    });
  } else {
    const td = q.trade_direction?.trim();
    if (td) {
      andParts.push({
        agent: {
          OR: [
            { trade_direction: { contains: td, mode: "insensitive" } },
            { trade_direction_row: { name: { contains: td, mode: "insensitive" } } }
          ]
        }
      });
    }
  }

  const cats = q.categories?.filter((x) => x.trim() !== "") ?? [];
  if (cats.length > 0) {
    andParts.push({
      OR: cats.map((cat) => ({ category: { contains: cat, mode: "insensitive" } }))
    });
  } else {
    const cat = q.category?.trim();
    if (cat) {
      andParts.push({ category: { contains: cat, mode: "insensitive" } });
    }
  }

  const ac = q.agent_consignment?.trim();
  if (ac === "consignment") andParts.push({ agent: { consignment: true } });
  else if (ac === "regular") andParts.push({ agent: { consignment: false } });

  const brs = q.agent_branches?.filter((b) => b.trim() !== "") ?? [];
  if (brs.length > 0) {
    andParts.push({ agent: { branch: { in: brs } } });
  } else {
    const br = q.agent_branch?.trim();
    if (br) {
      andParts.push({ agent: { branch: br } });
    }
  }

  const cFrom = q.consignment_due_from?.trim() ? parseIsoDateStartUtc(q.consignment_due_from) : null;
  const cTo = q.consignment_due_to?.trim() ? parseIsoDateEndUtc(q.consignment_due_to) : null;
  if (cFrom && cTo) {
    andParts.push({ license_until: { gte: cFrom, lte: cTo } });
  } else if (cFrom) {
    andParts.push({ license_until: { gte: cFrom } });
  } else if (cTo) {
    andParts.push({ license_until: { lte: cTo } });
  }

  if (!opts?.skipTerritoryFilters) {
    const regions = q.territory_regions?.filter((x) => x.trim() !== "") ?? [];
    if (regions.length > 0) {
      andParts.push({
        OR: regions.map((r) => ({ region: { contains: r, mode: "insensitive" } }))
      });
    } else if (q.territory_region?.trim()) {
      andParts.push({ region: { contains: q.territory_region.trim(), mode: "insensitive" } });
    }

    const cities = q.territory_cities?.filter((x) => x.trim() !== "") ?? [];
    if (cities.length > 0) {
      andParts.push({
        OR: cities.map((c) => ({ city: { contains: c, mode: "insensitive" } }))
      });
    } else if (q.territory_city?.trim()) {
      andParts.push({ city: { contains: q.territory_city.trim(), mode: "insensitive" } });
    }

    if (q.territory_district?.trim()) {
      andParts.push({ district: { contains: q.territory_district.trim(), mode: "insensitive" } });
    }

    const zones = q.territory_zones?.filter((x) => x.trim() !== "") ?? [];
    if (zones.length > 0) {
      andParts.push({
        OR: zones.map((z) => ({ zone: { contains: z, mode: "insensitive" } }))
      });
    } else if (q.territory_zone?.trim()) {
      andParts.push({ zone: { contains: q.territory_zone.trim(), mode: "insensitive" } });
    }
  }

  const pts = q.agent_payment_types?.filter((x) => x.trim() !== "") ?? [];
  if (pts.length > 0) {
    andParts.push({
      OR: pts.map((pt) => ({
        payments: { some: { entry_kind: "payment", payment_type: pt } }
      }))
    });
  } else {
    const pt = q.agent_payment_type?.trim();
    if (pt) {
      andParts.push({
        payments: { some: { entry_kind: "payment", payment_type: pt } }
      });
    }
  }

  if (!opts?.skipBalanceFilter) {
    const bfs =
      q.balance_filters?.filter((x) => x === "debt" || x === "credit") ??
      (q.balance_filter?.trim() === "debt" || q.balance_filter?.trim() === "credit"
        ? [q.balance_filter.trim()]
        : []);
    if (bfs.length === 1) {
      const bf = bfs[0]!;
      if (bf === "debt") {
        andParts.push({ client_balances: { some: { balance: { lt: 0 } } } });
      } else if (bf === "credit") {
        andParts.push({ client_balances: { some: { balance: { gt: 0 } } } });
      }
    } else if (bfs.length >= 2) {
      const hasDebt = bfs.includes("debt");
      const hasCredit = bfs.includes("credit");
      if (hasDebt && !hasCredit) {
        andParts.push({ client_balances: { some: { balance: { lt: 0 } } } });
      } else if (hasCredit && !hasDebt) {
        andParts.push({ client_balances: { some: { balance: { gt: 0 } } } });
      }
    }
  }

  const s = q.search?.trim();
  if (s) {
    const orParts = buildClientBalanceSearchOrClause(s);
    if (orParts.length > 0) andParts.push({ OR: orParts });
  }

  return { AND: andParts };
}
