import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { AccessCtx, IncomeReportQuery } from "./income-report.types";
import { KNOWN_SUMMARY_KEYS } from "./income-report.types";
import { asNum, fetchIncomeRows } from "./income-report.fetch";

export async function getIncomeReport(tenantId: number, query: IncomeReportQuery, ctx: AccessCtx) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const currencyEntries = resolveCurrencyEntries(refs);
  const paymentEntries = resolvePaymentMethodEntries(refs, currencyEntries);
  const paymentTypeKeys = [
    ...new Set(
      paymentEntries.flatMap((entry) => {
        const out = [
          paymentMethodStorageKey(entry),
          entry.name,
          entry.code ?? "",
          entry.id
        ]
          .map((x) => x.trim())
          .filter(Boolean);
        return out;
      })
    )
  ];
  const labelOfPaymentType = (key: string) => resolvePaymentMethodRefToLabel(key, paymentEntries) ?? key;

  const rows = await fetchIncomeRows(tenantId, query, ctx);
  const summaryMap = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const amount = asNum(row.amount);
    total += amount;
    summaryMap.set(row.payment_type, (summaryMap.get(row.payment_type) ?? 0) + amount);
  }
  const summary = {
    total,
    items: [
      ...KNOWN_SUMMARY_KEYS.map((k) => ({ key: k, amount: summaryMap.get(k) ?? 0 })),
      ...[...summaryMap.keys()]
        .filter((k) => !KNOWN_SUMMARY_KEYS.includes(k))
        .sort()
        .map((k) => ({ key: k, amount: summaryMap.get(k) ?? 0 }))
    ]
  };

  const period = [...summaryMap.entries()].map(([payment_type, amount]) => ({ payment_type, amount }));
  const paymentTypeLabels = Object.fromEntries(
    [...summaryMap.keys()].map((key) => [key, labelOfPaymentType(key)])
  ) as Record<string, string>;

  const territoryMap = new Map<string, { territory: string; byType: Record<string, number>; total: number }>();
  for (const row of rows) {
    const territory = [row.territory_1, row.territory_2, row.territory_3].filter(Boolean).join(" / ") || "—";
    const key = territory;
    const entry = territoryMap.get(key) ?? { territory, byType: {}, total: 0 };
    const amount = asNum(row.amount);
    entry.byType[row.payment_type] = (entry.byType[row.payment_type] ?? 0) + amount;
    entry.total += amount;
    territoryMap.set(key, entry);
  }
  const territories = [...territoryMap.values()].sort((a, b) => b.total - a.total);

  const clientMap = new Map<number, {
    client_id: number; client_name: string; agent_name: string; territory: string; byType: Record<string, number>; total: number;
  }>();
  for (const row of rows) {
    const entry = clientMap.get(row.client_id) ?? {
      client_id: row.client_id,
      client_name: row.client_name,
      agent_name: row.agent_name ?? "—",
      territory: [row.territory_1, row.territory_2, row.territory_3].filter(Boolean).join(" / ") || "—",
      byType: {},
      total: 0
    };
    const amount = asNum(row.amount);
    entry.byType[row.payment_type] = (entry.byType[row.payment_type] ?? 0) + amount;
    entry.total += amount;
    clientMap.set(row.client_id, entry);
  }
  const clients = [...clientMap.values()].sort((a, b) => b.total - a.total);

  const agentMap = new Map<number, { agent_id: number; agent_name: string; byType: Record<string, number>; total: number }>();
  for (const row of rows) {
    if (!row.agent_id) continue;
    const entry = agentMap.get(row.agent_id) ?? {
      agent_id: row.agent_id,
      agent_name: row.agent_name ?? "—",
      byType: {},
      total: 0
    };
    const amount = asNum(row.amount);
    entry.byType[row.payment_type] = (entry.byType[row.payment_type] ?? 0) + amount;
    entry.total += amount;
    agentMap.set(row.agent_id, entry);
  }
  const agents = [...agentMap.values()].sort((a, b) => b.total - a.total);

  return { summary, period, territories, clients, agents, paymentTypeLabels, paymentTypeKeys };
}
