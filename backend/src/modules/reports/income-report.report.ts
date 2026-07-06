import { prisma } from "../../config/database";
import {
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { AccessCtx, IncomeReportQuery, IncomeSummaryPaymentType } from "./income-report.types";
import { asNum, fetchIncomeRows } from "./income-report.fetch";
import {
  buildIncomeCatalogColumns,
  buildIncomePaymentTypeLabels,
  INCOME_OTHER_PAYMENT_KEY,
  INCOME_OTHER_PAYMENT_LABEL,
  resolveIncomePaymentBucketKey
} from "./income-report.payment-keys";

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
  const catalogColumns = buildIncomeCatalogColumns(paymentEntries);
  const paymentTypeLabels = buildIncomePaymentTypeLabels(catalogColumns);
  const catalogKeys = catalogColumns.map((c) => c.key);

  const rows = await fetchIncomeRows(tenantId, query, ctx);
  const summaryMap = new Map<string, number>();
  let total = 0;

  for (const row of rows) {
    const amount = asNum(row.amount);
    total += amount;
    const bucketKey = resolveIncomePaymentBucketKey(row.payment_type, paymentEntries);
    summaryMap.set(bucketKey, (summaryMap.get(bucketKey) ?? 0) + amount);
  }

  const by_payment_method: IncomeSummaryPaymentType[] = catalogColumns.map(({ key, label }) => ({
    key,
    label,
    amount: summaryMap.get(key) ?? 0
  }));
  const otherAmount = summaryMap.get(INCOME_OTHER_PAYMENT_KEY) ?? 0;
  if (otherAmount > 0) {
    by_payment_method.push({
      key: INCOME_OTHER_PAYMENT_KEY,
      label: INCOME_OTHER_PAYMENT_LABEL,
      amount: otherAmount
    });
  }

  const summary = {
    total,
    by_payment_method,
    items: by_payment_method.map((x) => ({ key: x.label, amount: x.amount }))
  };

  const paymentTypeKeys = [
    ...catalogKeys,
    ...(otherAmount > 0 ? [INCOME_OTHER_PAYMENT_KEY] : [])
  ];

  const period = paymentTypeKeys.map((key) => ({
    payment_type: key,
    amount: summaryMap.get(key) ?? 0
  }));

  const territoryMap = new Map<string, { territory: string; byType: Record<string, number>; total: number }>();
  for (const row of rows) {
    const territory = [row.territory_1, row.territory_2, row.territory_3].filter(Boolean).join(" / ") || "—";
    const bucketKey = resolveIncomePaymentBucketKey(row.payment_type, paymentEntries);
    const entry = territoryMap.get(territory) ?? { territory, byType: {}, total: 0 };
    const amount = asNum(row.amount);
    entry.byType[bucketKey] = (entry.byType[bucketKey] ?? 0) + amount;
    entry.total += amount;
    territoryMap.set(territory, entry);
  }
  const territories = [...territoryMap.values()].sort((a, b) => b.total - a.total);

  const clientMap = new Map<
    number,
    {
      client_id: number;
      client_name: string;
      agent_name: string;
      territory: string;
      byType: Record<string, number>;
      total: number;
    }
  >();
  for (const row of rows) {
    const bucketKey = resolveIncomePaymentBucketKey(row.payment_type, paymentEntries);
    const entry = clientMap.get(row.client_id) ?? {
      client_id: row.client_id,
      client_name: row.client_name,
      agent_name: row.agent_name ?? "—",
      territory: [row.territory_1, row.territory_2, row.territory_3].filter(Boolean).join(" / ") || "—",
      byType: {},
      total: 0
    };
    const amount = asNum(row.amount);
    entry.byType[bucketKey] = (entry.byType[bucketKey] ?? 0) + amount;
    entry.total += amount;
    clientMap.set(row.client_id, entry);
  }
  const clients = [...clientMap.values()].sort((a, b) => b.total - a.total);

  const agentMap = new Map<
    number,
    { agent_id: number; agent_name: string; byType: Record<string, number>; total: number }
  >();
  for (const row of rows) {
    if (!row.agent_id) continue;
    const bucketKey = resolveIncomePaymentBucketKey(row.payment_type, paymentEntries);
    const entry = agentMap.get(row.agent_id) ?? {
      agent_id: row.agent_id,
      agent_name: row.agent_name ?? "—",
      byType: {},
      total: 0
    };
    const amount = asNum(row.amount);
    entry.byType[bucketKey] = (entry.byType[bucketKey] ?? 0) + amount;
    entry.total += amount;
    agentMap.set(row.agent_id, entry);
  }
  const agents = [...agentMap.values()].sort((a, b) => b.total - a.total);

  return { summary, period, territories, clients, agents, paymentTypeLabels, paymentTypeKeys };
}
