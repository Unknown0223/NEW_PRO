import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { supervisorDisplayNameOrNull } from "../access/access-supervisor-display";
import type {
  AgentBalanceRow,
  ClientBalanceListResponse,
  ClientBalanceRow
} from "./client-balances.types";
import { agentInclude } from "./client-balances.constants";
import { loadConsignmentDueByClient } from "./client-balances.consignment-due";
import {
  loadPaymentNetNormByClient,
  loadTenantPaymentRefs,
  loadUnpaidOrderBalanceRawByPaymentRef,
  processUnpaidPayRefRows
} from "./client-balances.payments.data";
import {
  buildSummaryOverpaymentsByType,
  compareNumForSort,
  moneySortValueFromPaymentAmounts,
  paymentAmountsNetMinusUnpaid,
  readSortDir
} from "./client-balances.payments.util";
import {
  loadBalancesAsOf,
  loadLastDeliveryByClient,
  loadLastPaymentByClient
} from "./client-balances.ledger";
import { loadClientBalanceView } from "./client-balance-view";
import { mapClientRow } from "./client-balances.mappers";
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
      agent: {
        select: {
          id: true,
          name: true,
          code: true,
          supervisor: { select: { name: true, role: true } }
        }
      },
      client_balances: { take: 1, select: { balance: true } }
    }
  });
  const ids = allClientsLedger.map((c) => c.id);
  perf("clients-all.ids-loaded", { ids: ids.length });
  const ledgerMergedByClient =
    ids.length > 0
      ? await loadClientBalanceView(tenantId, ids, "ledger_merged", { asOfEnd })
      : new Map<number, Prisma.Decimal>();
  perf("clients-all.summary-sources-loaded", {
    ledgerMerged: ledgerMergedByClient.size
  });
  let sumMergedTotal = new Prisma.Decimal(0);
  for (const id of ids) {
    sumMergedTotal = sumMergedTotal.add(ledgerMergedByClient.get(id) ?? new Prisma.Decimal(0));
  }
  const totalBalanceStr = sumMergedTotal.toString();

  const { labels: sprLabels, entries: pmEntries } = await loadTenantPaymentRefs(tenantId);
  const [payNormAllClients, rawUnpaidAll] = await Promise.all([
    loadPaymentNetNormByClient(tenantId, ids, asOfEnd, pmEntries),
    loadUnpaidOrderBalanceRawByPaymentRef(tenantId, ids, odFrom, odTo)
  ]);
  perf("clients-all.payment-sources-loaded", {
    payTypeCount: sprLabels.length,
    unpaidRows: rawUnpaidAll.length
  });
  const { byClient: unpaidByClientMethod } = processUnpaidPayRefRows(
    rawUnpaidAll,
    pmEntries,
    sprLabels
  );
  const summaryPaymentByType = buildSummaryOverpaymentsByType(
    sprLabels,
    allClientsLedger.map((c) => ({
      balance: ledgerMergedByClient.get(c.id) ?? new Prisma.Decimal(0),
      payNorm: payNormAllClients.get(c.id),
      unpaidNorm: unpaidByClientMethod.get(c.id)
    }))
  );

  if (q.view === "agents") {
    const fallbackAgentByClient = new Map<number, number | null>(
      allClientsLedger.map((c) => [c.id, c.agent_id ?? null])
    );
    const workplaceByClient =
      ids.length > 0
        ? await loadWorkplaceAgentByClient(tenantId, ids, fallbackAgentByClient)
        : new Map<number, number | null>();
    const [payNormByClient, debtSplits, cardNetByClient] = await Promise.all([
      Promise.resolve(payNormAllClients),
      ids.length > 0
        ? loadDebtSplitByClient(tenantId, ids, workplaceByClient)
        : Promise.resolve(new Map()),
      ids.length > 0
        ? loadClientBalanceView(tenantId, ids, "card_net")
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
      /** Mijoz kartasidagi «Общий»: to‘lovlar minus yetkazilgan zakazlar. */
      const bal = cardNetByClient.get(c.id) ?? new Prisma.Decimal(0);
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
    const agentRows: AgentBalanceRow[] = Array.from(byAgent.entries())
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
          payment_amounts: paymentAmountsNetMinusUnpaid(sprLabels, v.payAgg, v.unpaidAgg, v.balance)
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
    } else if (sortBy === "agent_code") {
      agentRows.sort((a, b) => {
        const cmp = (a.agent_code ?? "").localeCompare(b.agent_code ?? "", "ru");
        return cmp * sortDir;
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
    let agentBalance = new Prisma.Decimal(0);
    const payByLabel = new Map<string, Prisma.Decimal>();
    for (const r of agentRows) {
      agentBalance = agentBalance.add(r.balance);
      for (const p of r.payment_amounts) {
        payByLabel.set(p.label, (payByLabel.get(p.label) ?? new Prisma.Decimal(0)).add(p.amount));
      }
    }
    return {
      view: "agents",
      data: slice,
      total,
      page,
      limit,
      summary: {
        balance: agentBalance.toString(),
        payment_by_type: summaryPaymentByType.map((p) => ({
          label: p.label,
          amount: (payByLabel.get(p.label) ?? new Prisma.Decimal(0)).toFixed(2)
        }))
      }
    };
  }

  if (q.view === "clients_legacy") {
    const [debtSplitsAll, cardNetByClient] = await Promise.all([
      loadDebtSplitByClient(tenantId, ids),
      ids.length > 0
        ? loadClientBalanceView(tenantId, ids, "card_net")
        : Promise.resolve(new Map())
    ]);
    let legacyIds = ids.filter((id) => {
      const s = debtSplitsAll.get(id);
      return s != null && s.legacy_debt.gt(0);
    });

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
      if (effectiveSort === "balance") {
        legacyIds = [...legacyIds].sort((a, b) => {
          const aBal = Number((cardNetByClient.get(a) ?? new Prisma.Decimal(0)).toString());
          const bBal = Number((cardNetByClient.get(b) ?? new Prisma.Decimal(0)).toString());
          return compareNumForSort(aBal, bBal, effectiveDir);
        });
      } else {
        legacyIds = [...legacyIds].sort((a, b) => {
          const aBal = cardNetByClient.get(a) ?? new Prisma.Decimal(0);
          const bBal = cardNetByClient.get(b) ?? new Prisma.Decimal(0);
          const aAmounts = paymentAmountsNetMinusUnpaid(
            sprLabels,
            payNormAllClients.get(a),
            unpaidByClientMethod.get(a),
            aBal
          );
          const bAmounts = paymentAmountsNetMinusUnpaid(
            sprLabels,
            payNormAllClients.get(b),
            unpaidByClientMethod.get(b),
            bBal
          );
          const aVal = moneySortValueFromPaymentAmounts(aAmounts, effectiveSort, sprLabels);
          const bVal = moneySortValueFromPaymentAmounts(bAmounts, effectiveSort, sprLabels);
          return compareNumForSort(aVal, bVal, effectiveDir);
        });
      }
    }

    let cardNetSum = new Prisma.Decimal(0);
    for (const id of legacyIds) cardNetSum = cardNetSum.add(cardNetByClient.get(id) ?? new Prisma.Decimal(0));
    const summaryPaymentLegacy = buildSummaryOverpaymentsByType(
      sprLabels,
      legacyIds.map((id) => ({
        balance: cardNetByClient.get(id) ?? new Prisma.Decimal(0),
        payNorm: payNormAllClients.get(id),
        unpaidNorm: unpaidByClientMethod.get(id)
      }))
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
    const [pagePayNorm, lastPays, lastOrds, pageBalAsOf, dueByClient] = await Promise.all([
      loadPaymentNetNormByClient(tenantId, pageIds, asOfEnd, pmEntries),
      loadLastPaymentByClient(tenantId, pageIds, asOfEnd),
      loadLastDeliveryByClient(tenantId, pageIds, asOfEnd),
      asOfEnd && pageIds.length > 0 ? loadBalancesAsOf(tenantId, pageIds, asOfEnd) : Promise.resolve(null),
      pageIds.length > 0
        ? loadConsignmentDueByClient(tenantId, pageIds, q.consignment_due_from, q.consignment_due_to)
        : Promise.resolve(new Map<number, Date>())
    ]);
    perf("clients-legacy-page.loaded", { pageIds: pageIds.length, total, page });

    const data: ClientBalanceRow[] = orderedClients.map((c) => {
      const displayBal = cardNetByClient.get(c.id) ?? new Prisma.Decimal(0);
      return mapClientRow(
        dueByClient.get(c.id) ? { ...c, license_until: dueByClient.get(c.id)! } : c,
        paymentAmountsNetMinusUnpaid(
          sprLabels,
          pagePayNorm.get(c.id),
          unpaidByClientMethod.get(c.id),
          displayBal
        ),
        lastPays.get(c.id),
        lastOrds.get(c.id),
        displayBal,
        null,
        null,
        debtSplitsAll.get(c.id) ?? null,
        asOfEnd
      );
    });

    return {
      view: "clients_legacy",
      data,
      total,
      page,
      limit,
      summary: { balance: cardNetSum.toString(), payment_by_type: summaryPaymentLegacy }
    };
  }

  const cardNetByClient =
    q.view === "clients" && ids.length > 0
      ? await loadClientBalanceView(tenantId, ids, "card_net", { asOfEnd })
      : null;
  let clientsSummaryBalance = totalBalanceStr;
  if (cardNetByClient) {
    let sum = new Prisma.Decimal(0);
    for (const id of ids) sum = sum.add(cardNetByClient.get(id) ?? new Prisma.Decimal(0));
    clientsSummaryBalance = sum.toString();
  }

  const sortBy = q.sort_by?.trim() ?? "";
  const sortDir = readSortDir(q);
  let sortedIds = ids;
  const clientMetaById = new Map(allClientsLedger.map((x) => [x.id, x]));
  const clientTextSortKey = (id: number, key: string): string => {
    const c = clientMetaById.get(id);
    if (!c) return "";
    if (key === "agent_name") return (c.agent?.name ?? "").trim();
    if (key === "agent_code") return (c.agent?.code ?? "").trim();
    if (key === "supervisor" || key === "supervisor_name") {
      return (supervisorDisplayNameOrNull(c.agent?.supervisor) ?? "").trim();
    }
    return "";
  };
  const balanceForClientsView = (id: number): Prisma.Decimal => {
    if (cardNetByClient) {
      return cardNetByClient.get(id) ?? new Prisma.Decimal(0);
    }
    return ledgerMergedByClient.get(id) ?? new Prisma.Decimal(0);
  };

  if (q.view === "clients" && (sortBy === "balance" || sortBy.startsWith("pay:"))) {
    if (sortBy === "balance") {
      sortedIds = [...ids].sort((a, b) => {
        const aBal = Number(balanceForClientsView(a).toString());
        const bBal = Number(balanceForClientsView(b).toString());
        return compareNumForSort(aBal, bBal, sortDir);
      });
    } else {
      sortedIds = [...ids].sort((a, b) => {
        const aBal = balanceForClientsView(a);
        const bBal = balanceForClientsView(b);
        const aAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAllClients.get(a),
          unpaidByClientMethod.get(a),
          aBal
        );
        const bAmounts = paymentAmountsNetMinusUnpaid(
          sprLabels,
          payNormAllClients.get(b),
          unpaidByClientMethod.get(b),
          bBal
        );
        const aVal = moneySortValueFromPaymentAmounts(aAmounts, sortBy, sprLabels);
        const bVal = moneySortValueFromPaymentAmounts(bAmounts, sortBy, sprLabels);
        return compareNumForSort(aVal, bVal, sortDir);
      });
    }
  } else if (
    q.view === "clients" &&
    (sortBy === "agent_name" ||
      sortBy === "agent_code" ||
      sortBy === "supervisor" ||
      sortBy === "supervisor_name")
  ) {
    sortedIds = [...ids].sort((a, b) => {
      const cmp = clientTextSortKey(a, sortBy).localeCompare(clientTextSortKey(b, sortBy), "ru");
      return cmp * sortDir;
    });
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
  const [pagePayNorm, lastPays, lastOrds, debtSplits, dueByClient] = await Promise.all([
    loadPaymentNetNormByClient(tenantId, pageIds, asOfEnd, pmEntries),
    loadLastPaymentByClient(tenantId, pageIds, asOfEnd),
    loadLastDeliveryByClient(tenantId, pageIds, asOfEnd),
    pageIds.length > 0 ? loadDebtSplitByClient(tenantId, pageIds) : Promise.resolve(new Map()),
    pageIds.length > 0
      ? loadConsignmentDueByClient(tenantId, pageIds, q.consignment_due_from, q.consignment_due_to)
      : Promise.resolve(new Map<number, Date>())
  ]);
  perf("clients-page.loaded", {
    pageIds: pageIds.length,
    total,
    page
  });

  const data: ClientBalanceRow[] = orderedClients.map((c) => {
    const displayBal = balanceForClientsView(c.id);
    return mapClientRow(
      dueByClient.get(c.id) ? { ...c, license_until: dueByClient.get(c.id)! } : c,
      paymentAmountsNetMinusUnpaid(
        sprLabels,
        pagePayNorm.get(c.id) ?? payNormAllClients.get(c.id),
        unpaidByClientMethod.get(c.id),
        displayBal
      ),
      lastPays.get(c.id),
      lastOrds.get(c.id),
      displayBal,
      null,
      null,
      debtSplits.get(c.id) ?? null,
      asOfEnd
    );
  });

  return {
    view: "clients",
    data,
    total,
    page,
    limit,
    summary: { balance: clientsSummaryBalance, payment_by_type: summaryPaymentByType }
  };
}
