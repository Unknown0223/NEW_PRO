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
import type {
  AgentBalanceRow,
  ClientBalanceListQuery,
  ClientBalanceListResponse,
  ClientBalanceRow
} from "./client-balances.types";
import { agentInclude } from "./client-balances.constants";
import { buildOrderCreatedLocalDateClause } from "./client-balances.date";
import { buildClientWhere } from "./client-balances.where";
import type { DeliveryDebtInfo } from "./client-balances.delivery";
import { makePerfMarker, parseIsoDateEndUtc } from "./client-balances.date";
import {
  loadPaymentNetNormByClient,
  loadTenantPaymentRefs,
  loadUnpaidOrderBalanceRawByPaymentRef,
  processUnpaidPayRefRows
} from "./client-balances.payments.data";
import {
  buildSummaryNetMinusUnpaid,
  compareNumForSort,
  moneySortValueFromPaymentAmounts,
  normPayTypeKey,
  paymentAmountsNetMinusUnpaid,
  readSortDir
} from "./client-balances.payments.util";
import { loadPaymentNetTotalsByTypeGlobally } from "./client-balances.payments.aggregate";
import { loadBalancesAsOf, loadLastDeliveryByClient, loadLastPaymentByClient } from "./client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  loadUnpaidDeliveredOrderDebtRows,
  mergeLedgerWithUnpaidDelivered
} from "./client-balances.delivery";
import { mapClientRow, mapDeliveryOrderRow } from "./client-balances.mappers";
import type { ClientBalancesReportContext } from "./client-balances.report.context";
import { loadDebtSplitByClient, loadWorkplaceAgentByClient } from "./client-debt-by-agent";

export async function listClientBalancesReportMain(
  ctx: ClientBalancesReportContext
): Promise<ClientBalanceListResponse> {
  const { tenantId, q, perf, page, limit, asOfEnd, odFrom, odTo, where } = ctx;
  const allClientsLedger = await prisma.client.findMany({
    where,
    select: {
      id: true,
      agent_id: true,
      agent: { select: { id: true, name: true, code: true } },
      client_balances: { take: 1, select: { balance: true } }
    }
  });
  const ids = allClientsLedger.map((c) => c.id);
  perf("clients-all.ids-loaded", { ids: ids.length });
  const [balAsOfMapAll, deliveryMapForSummary] = await Promise.all([
    asOfEnd && ids.length > 0 ? loadBalancesAsOf(tenantId, ids, asOfEnd) : Promise.resolve(null),
    loadDeliveryDebtByClient(tenantId, ids, odFrom, odTo)
  ]);
  perf("clients-all.summary-sources-loaded", {
    asOfCount: balAsOfMapAll?.size ?? 0,
    deliveryMap: deliveryMapForSummary.size
  });
  let sumMergedTotal = new Prisma.Decimal(0);
  for (const c of allClientsLedger) {
    const ledger = balAsOfMapAll?.get(c.id) ?? c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
    const d = deliveryMapForSummary.get(c.id);
    const blendPass = d && d.debt.gt(0) ? d : null;
    sumMergedTotal = sumMergedTotal.add(mergeLedgerWithUnpaidDelivered(ledger, blendPass ?? undefined));
  }
  const totalBalanceStr = sumMergedTotal.toString();

  const { labels: sprLabels, entries: pmEntries } = await loadTenantPaymentRefs(tenantId);
  const [netGlobalByType, rawUnpaidAll] = await Promise.all([
    loadPaymentNetTotalsByTypeGlobally(tenantId, ids, asOfEnd, pmEntries),
    loadUnpaidOrderBalanceRawByPaymentRef(tenantId, ids, odFrom, odTo)
  ]);
  perf("clients-all.payment-sources-loaded", {
    payTypeCount: sprLabels.length,
    unpaidRows: rawUnpaidAll.length
  });
  const { byClient: unpaidByClientMethod, globalUnpaidNorm } = processUnpaidPayRefRows(
    rawUnpaidAll,
    pmEntries,
    sprLabels
  );
  const summaryPaymentByType = buildSummaryNetMinusUnpaid(sprLabels, netGlobalByType, globalUnpaidNorm);

  if (q.view === "agents") {
    const fallbackAgentByClient = new Map<number, number | null>(
      allClientsLedger.map((c) => [c.id, c.agent_id ?? null])
    );
    const workplaceByClient =
      ids.length > 0
        ? await loadWorkplaceAgentByClient(tenantId, ids, fallbackAgentByClient)
        : new Map<number, number | null>();
    const [payNormByClient, debtSplits] = await Promise.all([
      loadPaymentNetNormByClient(tenantId, ids, asOfEnd, pmEntries),
      ids.length > 0
        ? loadDebtSplitByClient(tenantId, ids, workplaceByClient)
        : Promise.resolve(new Map())
    ]);
    perf("agents.aggregates-loaded", {
      ids: ids.length,
      payNormClients: payNormByClient.size,
      debtSplits: debtSplits.size,
      workplace: workplaceByClient.size
    });
    const byAgent = new Map<
      number | null,
      {
        clients: number;
        balance: Prisma.Decimal;
        legacy_debt: Prisma.Decimal;
        current_debt: Prisma.Decimal;
        payAgg: Map<string, Prisma.Decimal>;
        unpaidAgg: Map<string, Prisma.Decimal>;
        name: string | null;
        code: string | null;
      }
    >();
    for (const c of allClientsLedger) {
      /** Real-time: ish o‘rnidagi joriy agent (slot), aks holda clients.agent_id. */
      const aid = workplaceByClient.get(c.id) ?? c.agent_id ?? null;
      const ledger = c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
      const base = balAsOfMapAll?.get(c.id) ?? ledger;
      const del = deliveryMapForSummary.get(c.id);
      const blendPass = del && del.debt.gt(0) ? del : null;
      /** «По клиентам» qatori bilan bir xil: ledger + yetkazilgan, yopilmagan zakazlar qarzi. */
      const bal = mergeLedgerWithUnpaidDelivered(base, blendPass ?? undefined);
      const split = debtSplits.get(c.id);
      const inner = payNormByClient.get(c.id);
      const cur = byAgent.get(aid) ?? {
        clients: 0,
        balance: new Prisma.Decimal(0),
        legacy_debt: new Prisma.Decimal(0),
        current_debt: new Prisma.Decimal(0),
        payAgg: new Map<string, Prisma.Decimal>(),
        unpaidAgg: new Map<string, Prisma.Decimal>(),
        name: aid === c.agent_id ? (c.agent?.name ?? null) : null,
        code: aid === c.agent_id ? (c.agent?.code ?? null) : null
      };
      cur.clients += 1;
      cur.balance = cur.balance.add(bal);
      if (split) {
        cur.legacy_debt = cur.legacy_debt.add(split.legacy_debt);
        cur.current_debt = cur.current_debt.add(split.current_debt);
      }
      if (inner) {
        for (const [nk, v] of inner) {
          cur.payAgg.set(nk, (cur.payAgg.get(nk) ?? new Prisma.Decimal(0)).add(v));
        }
      }
      const uClient = unpaidByClientMethod.get(c.id);
      if (uClient) {
        for (const [nk, v] of uClient) {
          cur.unpaidAgg.set(nk, (cur.unpaidAgg.get(nk) ?? new Prisma.Decimal(0)).add(v));
        }
      }
      if (aid === c.agent_id && c.agent?.name) {
        cur.name = c.agent.name;
        cur.code = c.agent.code ?? null;
      }
      byAgent.set(aid, cur);
    }

    const agentIdsForMeta = [...byAgent.keys()].filter(
      (id): id is number => id != null && Number.isFinite(id) && id > 0
    );
    const agentMeta =
      agentIdsForMeta.length === 0
        ? []
        : await prisma.user.findMany({
            where: { tenant_id: tenantId, id: { in: agentIdsForMeta } },
            select: { id: true, name: true, code: true, is_active: true }
          });
    const metaById = new Map(agentMeta.map((u) => [u.id, u]));

    /**
     * Faqat aktiv agentlar (+ «Без агента»).
     * Guruhlash — ish o‘rnidagi joriy agent; bo‘shatilgan agent qarzi current_debt da.
     */
    let agentRows: AgentBalanceRow[] = Array.from(byAgent.entries())
      .map(([agent_id, v]) => {
        const meta = agent_id != null ? metaById.get(agent_id) : undefined;
        return {
          agent_id,
          agent_name: v.name ?? meta?.name ?? null,
          agent_code: v.code ?? meta?.code ?? null,
          clients_count: v.clients,
          balance: v.balance.toString(),
          legacy_debt: v.legacy_debt.toString(),
          current_debt: v.current_debt.toString(),
          is_active: agent_id == null ? null : (meta?.is_active ?? null),
          payment_amounts: paymentAmountsNetMinusUnpaid(sprLabels, v.payAgg, v.unpaidAgg)
        };
      })
      .filter((r) => r.agent_id == null || r.is_active === true);

    const sortBy = q.sort_by?.trim() ?? "";
    const sortDir = readSortDir(q);
    if (sortBy === "balance") {
      agentRows.sort((a, b) =>
        compareNumForSort(Number(a.balance), Number(b.balance), sortDir)
      );
    } else if (sortBy === "legacy_debt") {
      agentRows.sort((a, b) =>
        compareNumForSort(Number(a.legacy_debt), Number(b.legacy_debt), sortDir)
      );
    } else if (sortBy === "current_debt") {
      agentRows.sort((a, b) =>
        compareNumForSort(Number(a.current_debt), Number(b.current_debt), sortDir)
      );
    } else if (sortBy === "clients_count") {
      agentRows.sort((a, b) => compareNumForSort(a.clients_count, b.clients_count, sortDir));
    } else if (sortBy === "agent_name") {
      agentRows.sort((a, b) => {
        const an = (a.agent_name ?? "").localeCompare(b.agent_name ?? "", "ru");
        return an * sortDir;
      });
    } else if (sortBy.startsWith("pay:")) {
      agentRows.sort((a, b) =>
        compareNumForSort(
          moneySortValueFromPaymentAmounts(a.payment_amounts, sortBy, sprLabels),
          moneySortValueFromPaymentAmounts(b.payment_amounts, sortBy, sprLabels),
          sortDir
        )
      );
    } else {
      agentRows.sort((a, b) => new Prisma.Decimal(a.balance).cmp(new Prisma.Decimal(b.balance)));
    }

    const total = agentRows.length;
    const slice = agentRows.slice((page - 1) * limit, page * limit);
    return {
      view: "agents",
      data: slice,
      total,
      page,
      limit,
      summary: { balance: totalBalanceStr, payment_by_type: summaryPaymentByType }
    };
  }

  if (q.view === "clients_legacy") {
    const debtSplitsAll = await loadDebtSplitByClient(tenantId, ids);
    let legacyIds = ids.filter((id) => {
      const s = debtSplitsAll.get(id);
      return s != null && s.legacy_debt.gt(0);
    });
    let legacySum = new Prisma.Decimal(0);
    for (const id of legacyIds) {
      legacySum = legacySum.add(debtSplitsAll.get(id)!.legacy_debt);
    }

    const sortBy = q.sort_by?.trim() ?? "";
    const sortDir = readSortDir(q);
    const effectiveSort = sortBy || "legacy_debt";
    const effectiveDir = sortBy ? sortDir : -1;

    if (effectiveSort === "legacy_debt" || effectiveSort === "current_debt") {
      legacyIds = [...legacyIds].sort((a, b) => {
        const sa = debtSplitsAll.get(a)!;
        const sb = debtSplitsAll.get(b)!;
        const av =
          effectiveSort === "current_debt"
            ? Number(sa.current_debt.toString())
            : Number(sa.legacy_debt.toString());
        const bv =
          effectiveSort === "current_debt"
            ? Number(sb.current_debt.toString())
            : Number(sb.legacy_debt.toString());
        return compareNumForSort(av, bv, effectiveDir);
      });
    } else if (effectiveSort === "balance" || effectiveSort.startsWith("pay:")) {
      const ledgerById = new Map(
        allClientsLedger.map((x) => [x.id, x.client_balances[0]?.balance ?? new Prisma.Decimal(0)])
      );
      if (effectiveSort === "balance") {
        legacyIds = [...legacyIds].sort((a, b) => {
          const aLedger = balAsOfMapAll?.get(a) ?? ledgerById.get(a) ?? new Prisma.Decimal(0);
          const bLedger = balAsOfMapAll?.get(b) ?? ledgerById.get(b) ?? new Prisma.Decimal(0);
          const aBal = Number(
            mergeLedgerWithUnpaidDelivered(aLedger, deliveryMapForSummary.get(a)).toString()
          );
          const bBal = Number(
            mergeLedgerWithUnpaidDelivered(bLedger, deliveryMapForSummary.get(b)).toString()
          );
          return compareNumForSort(aBal, bBal, effectiveDir);
        });
      } else {
        const payNormAll = await loadPaymentNetNormByClient(tenantId, legacyIds, asOfEnd, pmEntries);
        legacyIds = [...legacyIds].sort((a, b) => {
          const aAmounts = paymentAmountsNetMinusUnpaid(
            sprLabels,
            payNormAll.get(a),
            unpaidByClientMethod.get(a)
          );
          const bAmounts = paymentAmountsNetMinusUnpaid(
            sprLabels,
            payNormAll.get(b),
            unpaidByClientMethod.get(b)
          );
          const aVal = moneySortValueFromPaymentAmounts(aAmounts, effectiveSort, sprLabels);
          const bVal = moneySortValueFromPaymentAmounts(bAmounts, effectiveSort, sprLabels);
          return compareNumForSort(aVal, bVal, effectiveDir);
        });
      }
    }

    const [netLegacyGlobal] = await Promise.all([
      loadPaymentNetTotalsByTypeGlobally(tenantId, legacyIds, asOfEnd, pmEntries)
    ]);
    const unpaidLegacyNorm = new Map<string, Prisma.Decimal>();
    for (const id of legacyIds) {
      const u = unpaidByClientMethod.get(id);
      if (!u) continue;
      for (const [nk, v] of u) {
        unpaidLegacyNorm.set(nk, (unpaidLegacyNorm.get(nk) ?? new Prisma.Decimal(0)).add(v));
      }
    }
    const summaryPaymentLegacy = buildSummaryNetMinusUnpaid(
      sprLabels,
      netLegacyGlobal,
      unpaidLegacyNorm
    );

    const total = legacyIds.length;
    const pageIds = legacyIds.slice((page - 1) * limit, page * limit);
    const clients =
      pageIds.length === 0
        ? []
        : await prisma.client.findMany({
            where: { id: { in: pageIds } },
            select: {
              id: true,
              name: true,
              is_active: true,
              legal_name: true,
              client_code: true,
              inn: true,
              phone: true,
              license_until: true,
              agent: { select: agentInclude.select },
              client_balances: { take: 1, select: { balance: true } }
            }
          });
    const clientsById = new Map(clients.map((c) => [c.id, c]));
    const orderedClients = pageIds.map((id) => clientsById.get(id)!).filter(Boolean);
    const [pagePayNorm, lastPays, lastOrds, pageBalAsOf] = await Promise.all([
      loadPaymentNetNormByClient(tenantId, pageIds, asOfEnd, pmEntries),
      loadLastPaymentByClient(tenantId, pageIds, asOfEnd),
      loadLastDeliveryByClient(tenantId, pageIds),
      asOfEnd && pageIds.length > 0 ? loadBalancesAsOf(tenantId, pageIds, asOfEnd) : Promise.resolve(null)
    ]);
    perf("clients-legacy-page.loaded", { pageIds: pageIds.length, total, page });

    const data: ClientBalanceRow[] = orderedClients.map((c) => {
      const b = deliveryMapForSummary.get(c.id);
      const blend = b && b.debt.gt(0) ? b : null;
      return mapClientRow(
        c,
        paymentAmountsNetMinusUnpaid(sprLabels, pagePayNorm.get(c.id), unpaidByClientMethod.get(c.id)),
        lastPays.get(c.id),
        lastOrds.get(c.id),
        pageBalAsOf?.get(c.id) ?? null,
        null,
        blend,
        debtSplitsAll.get(c.id) ?? null
      );
    });

    return {
      view: "clients_legacy",
      data,
      total,
      page,
      limit,
      summary: { balance: legacySum.toString(), payment_by_type: summaryPaymentLegacy }
    };
  }

  const sortBy = q.sort_by?.trim() ?? "";
  const sortDir = readSortDir(q);
  let sortedIds = ids;
  const ledgerById = new Map(
    allClientsLedger.map((x) => [x.id, x.client_balances[0]?.balance ?? new Prisma.Decimal(0)])
  );
  if (q.view === "clients" && (sortBy === "balance" || sortBy.startsWith("pay:"))) {
    if (sortBy === "balance") {
      sortedIds = [...ids].sort((a, b) => {
        const aLedger = balAsOfMapAll?.get(a) ?? ledgerById.get(a) ?? new Prisma.Decimal(0);
        const bLedger = balAsOfMapAll?.get(b) ?? ledgerById.get(b) ?? new Prisma.Decimal(0);
        const aBal = Number(
          mergeLedgerWithUnpaidDelivered(aLedger, deliveryMapForSummary.get(a)).toString()
        );
        const bBal = Number(
          mergeLedgerWithUnpaidDelivered(bLedger, deliveryMapForSummary.get(b)).toString()
        );
        return compareNumForSort(aBal, bBal, sortDir);
      });
    } else {
      const payNormAll = await loadPaymentNetNormByClient(tenantId, ids, asOfEnd, pmEntries);
      sortedIds = [...ids].sort((a, b) => {
        const aAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAll.get(a),
          unpaidByClientMethod.get(a)
        );
        const bAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAll.get(b),
          unpaidByClientMethod.get(b)
        );
        const aVal = moneySortValueFromPaymentAmounts(aAmounts, sortBy, sprLabels);
        const bVal = moneySortValueFromPaymentAmounts(bAmounts, sortBy, sprLabels);
        return compareNumForSort(aVal, bVal, sortDir);
      });
    }
  }

  const total = ids.length;
  const pageIds = sortedIds.slice((page - 1) * limit, page * limit);
  const clients =
    pageIds.length === 0
      ? []
      : await prisma.client.findMany({
          where: { id: { in: pageIds } },
          select: {
            id: true,
            name: true,
            is_active: true,
            legal_name: true,
            client_code: true,
            inn: true,
            phone: true,
            license_until: true,
            agent: { select: agentInclude.select },
            client_balances: { take: 1, select: { balance: true } }
          }
        });

  const clientsById = new Map(clients.map((c) => [c.id, c]));
  const orderedClients = pageIds.map((id) => clientsById.get(id)!).filter(Boolean);
  const deliveryMapPage =
    q.view === "clients" && pageIds.length > 0 ? deliveryMapForSummary : new Map<number, DeliveryDebtInfo>();
  const [pagePayNorm, lastPays, lastOrds, pageBalAsOf, debtSplits] = await Promise.all([
    loadPaymentNetNormByClient(tenantId, pageIds, asOfEnd, pmEntries),
    loadLastPaymentByClient(tenantId, pageIds, asOfEnd),
    loadLastDeliveryByClient(tenantId, pageIds),
    asOfEnd && pageIds.length > 0 ? loadBalancesAsOf(tenantId, pageIds, asOfEnd) : Promise.resolve(null),
    pageIds.length > 0 ? loadDebtSplitByClient(tenantId, pageIds) : Promise.resolve(new Map())
  ]);
  perf("clients-page.loaded", {
    pageIds: pageIds.length,
    total,
    page
  });

  const data: ClientBalanceRow[] = orderedClients.map((c) => {
    const b = deliveryMapPage.get(c.id);
    const blend = b && b.debt.gt(0) ? b : null;
    return mapClientRow(
      c,
      paymentAmountsNetMinusUnpaid(sprLabels, pagePayNorm.get(c.id), unpaidByClientMethod.get(c.id)),
      lastPays.get(c.id),
      lastOrds.get(c.id),
      pageBalAsOf?.get(c.id) ?? null,
      null,
      blend,
      debtSplits.get(c.id) ?? null
    );
  });

  return {
    view: "clients",
    data,
    total,
    page,
    limit,
    summary: { balance: totalBalanceStr, payment_by_type: summaryPaymentByType }
  };
}
