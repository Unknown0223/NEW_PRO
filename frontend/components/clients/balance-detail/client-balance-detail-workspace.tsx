"use client";

import { useClientProfileLedgerFiltersOptional } from "@/components/clients/client-profile-ledger-filters-context";
import { BalanceDetailCards } from "@/components/clients/balance-detail/balance-detail-cards";
import { BalanceDetailCustomerHeader } from "@/components/clients/balance-detail/balance-detail-customer-header";
import { BalanceDetailFilterPanel } from "@/components/clients/balance-detail/balance-detail-filter-panel";
import { BalanceDetailLedgerTable } from "@/components/clients/balance-detail/balance-detail-ledger-table";
import {
  BalanceDetailColumnsModal,
  BalanceDetailExportModal,
  BalanceDetailOverallModal,
  BalanceDetailTransactionModal
} from "@/components/clients/balance-detail/balance-detail-modals";
import { BalanceDetailPagination } from "@/components/clients/balance-detail/balance-detail-pagination";
import { BalanceDetailReportFooter } from "@/components/clients/balance-detail/balance-detail-report-footer";
import { BalanceDetailToolbar } from "@/components/clients/balance-detail/balance-detail-toolbar";
import { api } from "@/lib/api";
import { BALANCE_DETAIL_COLUMNS } from "@/lib/client-balance-detail/columns";
import {
  filterOptionsFromRows,
  ledgerTotalsFromRows,
  mapBalanceCards,
  mapCustomer,
  mapLedgerRow
} from "@/lib/client-balance-detail/map";
import type {
  BalanceDetailColumnDef,
  BalanceDetailFilters,
  BalanceDetailRow,
  BalanceDetailSortDir,
  BalanceDetailSortField,
  BalanceDetailViewTab
} from "@/lib/client-balance-detail/types";
import { emptyBalanceDetailFilters } from "@/lib/client-balance-detail/types";
import type { ClientBalanceLedgerResponse, ClientLedgerRow } from "@/lib/client-balance-ledger-types";
import { downloadXlsxWorkbook } from "@/lib/download-xlsx";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  tenantSlug: string;
  clientId: number;
  embedded?: boolean;
  canEditPayments?: boolean;
  onEditPayment?: (paymentId: number) => void;
  onAddDebt?: () => void;
  onAddPayment?: () => void;
};

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseAmount(s: string | null | undefined): number {
  const t = String(s)
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function consignmentDaNet(v: boolean | null | undefined): string {
  return v === true ? "Да" : "Нет";
}

function formatLedgerPaymentMethodCell(r: ClientLedgerRow): string {
  const pay = (r.payment_type ?? "").trim();
  const ord = (r.order_payment_method_label ?? "").trim();
  if (r.row_kind === "payment" && ord) {
    if (!pay) return ord;
    if (pay !== ord) return `${pay} · заказ: ${ord}`;
  }
  return pay;
}

function formatPayTypeLower(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function generalDebtPositive(r: ClientLedgerRow): number {
  const d = parseAmount(r.debt_amount ?? "0");
  return Math.abs(d) < 1e-12 ? 0 : Math.abs(d);
}

function generalPaymentPositive(r: ClientLedgerRow): number {
  return Math.max(0, parseAmount(r.payment_amount ?? "0"));
}

function formatLedgerExcelDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function applyClientFilters(rows: BalanceDetailRow[], filters: BalanceDetailFilters, showSystem: boolean): BalanceDetailRow[] {
  return rows.filter((row) => {
    if (!showSystem && row.isSystem) return false;
    const r = row.raw;
    if (filters.rowKind === "debt" && generalDebtPositive(r) <= 0 && parseAmount(r.debt_amount) >= 0) {
      if (row.debt === 0) return false;
    }
    if (filters.rowKind === "payment" && generalPaymentPositive(r) <= 0 && row.payment <= 0) return false;
    if (filters.types.length) {
      const kind =
        r.row_kind === "order" ? "Заказ" : r.entry_kind === "client_expense" ? "Расход" : "Оплата";
      if (!filters.types.includes(kind)) return false;
    }
    if (filters.paymentMethods.length) {
      const m = row.paymentMethod.toLowerCase();
      const ok = filters.paymentMethods.some((pm) => {
        const p = pm.toLowerCase();
        if (p.includes("нал")) return m.includes("нал") || m.includes("naqd") || m.includes("cash");
        if (p.includes("переч")) return m.includes("переч") || m.includes("perech");
        if (p.includes("термин")) return m.includes("термин") || m.includes("terminal") || m.includes("карт");
        return m.includes(p);
      });
      if (!ok) return false;
    }
    if (filters.agents.length && !filters.agents.includes(row.agent)) return false;
    if (filters.expeditors.length && !filters.expeditors.includes(row.expeditor)) return false;
    if (filters.consignment === "yes" && !row.consignment) return false;
    if (filters.consignment === "no" && row.consignment) return false;
    if (filters.cashbox && row.cashbox !== filters.cashbox) return false;
    if (filters.comment && !row.comment.toLowerCase().includes(filters.comment.toLowerCase())) return false;
    if (filters.createdBy && row.createdBy !== filters.createdBy) return false;
    const debtAbs = Math.abs(row.debt);
    if (filters.debtMin && debtAbs < Number(filters.debtMin)) return false;
    if (filters.debtMax && debtAbs > Number(filters.debtMax)) return false;
    if (filters.paymentMin && row.payment < Number(filters.paymentMin)) return false;
    if (filters.paymentMax && row.payment > Number(filters.paymentMax)) return false;
    return true;
  });
}

function sortRows(
  rows: BalanceDetailRow[],
  field: BalanceDetailSortField,
  dir: BalanceDetailSortDir
): BalanceDetailRow[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "createdAt":
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "debt":
        cmp = Math.abs(a.debt) - Math.abs(b.debt);
        break;
      case "payment":
        cmp = a.payment - b.payment;
        break;
      case "docNumber":
        cmp = a.docNumber.localeCompare(b.docNumber, "ru");
        break;
    }
    return cmp * mul;
  });
}

export function ClientBalanceDetailWorkspace({
  tenantSlug,
  clientId,
  embedded = false,
  canEditPayments,
  onEditPayment,
  onAddDebt,
  onAddPayment
}: Props) {
  const queryClient = useQueryClient();
  const profileLedgerCtx = useClientProfileLedgerFiltersOptional();

  const [tab, setTab] = useState<BalanceDetailViewTab>("overall");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [localShowGeneralBlock, setLocalShowGeneralBlock] = useState(true);
  const [localAgentFilter, setLocalAgentFilter] = useState<{ agentIds: number[]; noAgent: boolean }>({
    agentIds: [],
    noAgent: false
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BalanceDetailFilters>(emptyBalanceDetailFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState<BalanceDetailSortField>("createdAt");
  const [sortDir, setSortDir] = useState<BalanceDetailSortDir>("desc");
  const [showSystemOps, setShowSystemOps] = useState(true);
  const [columns, setColumns] = useState<BalanceDetailColumnDef[]>(BALANCE_DETAIL_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [selectedRow, setSelectedRow] = useState<BalanceDetailRow | null>(null);
  const [overallModalOpen, setOverallModalOpen] = useState(false);

  const showGeneralBlock =
    embedded && profileLedgerCtx ? profileLedgerCtx.showGeneralBlock : localShowGeneralBlock;
  const setShowGeneralBlock =
    embedded && profileLedgerCtx ? profileLedgerCtx.setShowGeneralBlock : setLocalShowGeneralBlock;
  const agentFilter = embedded && profileLedgerCtx ? profileLedgerCtx.agentFilter : localAgentFilter;
  const setAgentFilter = embedded && profileLedgerCtx ? profileLedgerCtx.setAgentFilter : setLocalAgentFilter;

  const rowFilter = filters.rowKind;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (embedded && profileLedgerCtx) return;
    setLocalAgentFilter({ agentIds: [], noAgent: false });
    setSelectedCardId(null);
  }, [clientId, embedded, profileLedgerCtx]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, limit, rowFilter, agentFilter.agentIds, agentFilter.noAgent, tab, filters]);

  const ledgerQs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (tab === "detailed") p.set("ledger_detail", "1");
    const df = dateFrom.trim() || filters.dateFrom.trim();
    const dt = dateTo.trim() || filters.dateTo.trim();
    if (df) p.set("date_from", df);
    if (dt) p.set("date_to", dt);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (rowFilter !== "all") p.set("ledger_kind", rowFilter);
    if (agentFilter.agentIds.length > 0) {
      p.set("agent_ids", [...agentFilter.agentIds].sort((a, b) => a - b).join(","));
    }
    if (agentFilter.noAgent) p.set("no_agent", "1");
    return p.toString();
  }, [page, limit, tab, dateFrom, dateTo, filters.dateFrom, filters.dateTo, debouncedSearch, rowFilter, agentFilter]);

  const ledgerQ = useQuery({
    queryKey: ["client-balance-ledger", tenantSlug, clientId, ledgerQs],
    staleTime: STALE.list,
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<ClientBalanceLedgerResponse>(
        `/api/${tenantSlug}/clients/${clientId}/balance-ledger?${ledgerQs}`
      );
      return data;
    }
  });

  const refreshAll = useCallback(() => {
    void ledgerQ.refetch();
    void queryClient.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug, clientId] });
    void queryClient.invalidateQueries({ queryKey: ["client-debtor-creditor-monthly", tenantSlug, clientId] });
  }, [ledgerQ, queryClient, tenantSlug, clientId]);

  const handleCardSelect = (id: string) => {
    const next = id === selectedCardId ? null : id;
    setSelectedCardId(next);
    if (!next) {
      setAgentFilter({ agentIds: [], noAgent: false });
      return;
    }
    if (next === "main") {
      setAgentFilter({ agentIds: [], noAgent: false });
      return;
    }
    if (next === "null") {
      setAgentFilter({ agentIds: [], noAgent: true });
      return;
    }
    const aid = Number.parseInt(next, 10);
    if (Number.isFinite(aid)) setAgentFilter({ agentIds: [aid], noAgent: false });
  };

  const data = ledgerQ.data;
  const customer = useMemo(() => (data ? mapCustomer(data) : null), [data]);
  const balanceCards = useMemo(
    () => (data ? mapBalanceCards(data, embedded ? showGeneralBlock : true) : []),
    [data, showGeneralBlock, embedded]
  );

  const filterOpts = useMemo(
    () => filterOptionsFromRows(data?.rows ?? []),
    [data?.rows]
  );

  const displayRows = useMemo(() => {
    if (!data) return [];
    const mapped = data.rows.map((r) => mapLedgerRow(r, tab));
    const filtered = applyClientFilters(mapped, filters, showSystemOps);
    return sortRows(filtered, sortField, sortDir);
  }, [data, tab, filters, showSystemOps, sortField, sortDir]);

  const totals = useMemo(() => ledgerTotalsFromRows(displayRows), [displayRows]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  const onSort = (field: BalanceDetailSortField) => {
    if (field === sortField) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const runExcel = useCallback(async () => {
    setExcelBusy(true);
    try {
      const p = new URLSearchParams({ page: "1", limit: "5000", ledger_detail: "1" });
      if (dateFrom.trim()) p.set("date_from", dateFrom.trim());
      if (dateTo.trim()) p.set("date_to", dateTo.trim());
      if (debouncedSearch) p.set("search", debouncedSearch);
      if (rowFilter !== "all") p.set("ledger_kind", rowFilter);
      if (agentFilter.agentIds.length > 0) {
        p.set("agent_ids", [...agentFilter.agentIds].sort((a, b) => a - b).join(","));
      }
      if (agentFilter.noAgent) p.set("no_agent", "1");
      const { data: exportData } = await api.get<ClientBalanceLedgerResponse>(
        `/api/${tenantSlug}/clients/${clientId}/balance-ledger?${p}`
      );
      const headersGeneral = [
        "Дата",
        "Тип",
        "Долг",
        "Оплата",
        "Способ оплаты",
        "Агент",
        "Экспедиторы",
        "Консигнация",
        "Касса",
        "Комментарий",
        "Кто создал"
      ];
      const headersDetailed = [
        "Дата",
        "Тип",
        "Название типа операции",
        "Тип заказ",
        "Консигнация",
        "Долг",
        "Оплата",
        "Баланс (после)",
        "Способ оплаты",
        "Агент",
        "Экспедиторы",
        "Комментарий",
        "Комментарий к транзакциям",
        "Кто создал"
      ];
      const fname = `balans-klient-${exportData.client.name.slice(0, 40).replace(/[/\\?%*:|"<>]/g, "_")}-${localYmd(new Date())}.xlsx`;
      await downloadXlsxWorkbook(fname, [
        {
          name: "Общий",
          headers: headersGeneral,
          rows: exportData.rows.map((r) => [
            formatLedgerExcelDate(r.sort_at),
            r.type_code,
            generalDebtPositive(r) || "",
            generalPaymentPositive(r) || "",
            formatLedgerPaymentMethodCell(r),
            r.agent_name ?? "",
            r.expeditor_name ?? "",
            consignmentDaNet(r.is_consignment),
            r.cash_desk_name ?? "",
            r.note ?? "",
            r.created_by_display ?? ""
          ]),
          colWidths: [18, 6, 14, 14, 14, 22, 16, 10, 18, 28, 20]
        },
        {
          name: "Подробно",
          headers: headersDetailed,
          rows: exportData.rows.map((r) => [
            formatLedgerExcelDate(r.sort_at),
            r.type_code,
            r.operation_type_code,
            r.order_kind_label ?? "",
            consignmentDaNet(r.is_consignment),
            parseAmount(r.debt_amount ?? "0") || "",
            parseAmount(r.payment_amount ?? "0") || "",
            r.balance_after != null && r.balance_after !== "" ? parseAmount(r.balance_after) : "",
            formatPayTypeLower(formatLedgerPaymentMethodCell(r)),
            r.agent_name ?? "",
            r.expeditor_name ?? "",
            r.comment_primary ?? "",
            r.comment_transaction ?? "",
            r.created_by_display ?? ""
          ]),
          colWidths: [18, 6, 8, 10, 10, 12, 12, 14, 12, 20, 16, 24, 24, 18]
        }
      ]);
      setExportOpen(false);
    } finally {
      setExcelBusy(false);
    }
  }, [tenantSlug, clientId, dateFrom, dateTo, debouncedSearch, rowFilter, agentFilter]);

  if (ledgerQ.isError) {
    return <p className="text-sm text-destructive">Не удалось загрузить данные.</p>;
  }

  if (!data) {
    return <p className="py-4 text-sm text-muted-foreground">Загрузка ведомости…</p>;
  }

  return (
    <div className={cn("space-y-4", !embedded && "rounded-lg bg-[#eef1f4] p-4 sm:p-6")}>
      {customer ? (
        <BalanceDetailCustomerHeader
          customer={customer}
          showOverallModal={overallModalOpen}
          onToggleOverallModal={setOverallModalOpen}
          onRefresh={refreshAll}
          refreshing={ledgerQ.isFetching}
          embedded={embedded}
          showGeneralBlock={showGeneralBlock}
          onToggleGeneralBlock={setShowGeneralBlock}
        />
      ) : null}

      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-gray-600">
            <input
              type="checkbox"
              checked={showGeneralBlock}
              onChange={(e) => setShowGeneralBlock(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[#1aa096]"
            />
            Показать общий блок
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {canEditPayments ? (
              <>
                <button
                  type="button"
                  onClick={onAddDebt}
                  className="h-8 rounded border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Долг
                </button>
                <button
                  type="button"
                  onClick={onAddPayment}
                  className="h-8 rounded border border-teal-200 px-3 text-xs font-medium text-teal-800 hover:bg-teal-50"
                >
                  Оплата
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={refreshAll}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1aa096] px-3 text-xs font-medium text-white hover:bg-[#158a81]"
            >
              Обновить
            </button>
          </div>
        </div>
      ) : null}

      {balanceCards.length > 0 ? (
        <BalanceDetailCards cards={balanceCards} selectedId={selectedCardId} onSelect={handleCardSelect} />
      ) : (
        <p className="text-xs text-gray-500">Нет активных заказов по агентам для карточек.</p>
      )}

      <div>
        <div className="flex">
          {(
            [
              ["overall", "Общий"],
              ["detailed", "Подробно"]
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTab(v)}
              className={cn(
                "-mb-px h-10 rounded-t-lg border border-b-0 px-6 text-[13px] font-medium transition-colors",
                tab === v
                  ? "relative z-10 border-gray-200 bg-white text-[#1aa096]"
                  : "border-transparent bg-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-lg rounded-tl-none border border-gray-200 bg-white">
          <BalanceDetailToolbar
            search={searchInput}
            onSearchChange={setSearchInput}
            perPage={limit}
            onPerPageChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            showSystemOps={showSystemOps}
            onShowSystemOpsChange={setShowSystemOps}
            sortField={sortField}
            sortDir={sortDir}
            onSortFieldChange={setSortField}
            onSortDirToggle={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            onColumnsClick={() => setColumnsOpen(true)}
            onFiltersClick={() => setFiltersOpen((o) => !o)}
            filtersOpen={filtersOpen}
            onRefresh={refreshAll}
            onExport={() => setExportOpen(true)}
            refreshing={ledgerQ.isFetching}
            exportBusy={excelBusy}
            canExport={displayRows.length > 0}
          />

          {filtersOpen ? (
            <BalanceDetailFilterPanel
              filters={filters}
              onChange={setFilters}
              agentOptions={filterOpts.agents}
              expeditorOptions={filterOpts.expeditors}
              cashboxOptions={filterOpts.cashboxes}
              creatorOptions={filterOpts.creators}
            />
          ) : null}

          <BalanceDetailLedgerTable
            rows={displayRows}
            tab={tab}
            columns={columns}
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={setSelectedRow}
            loading={ledgerQ.isLoading}
            canEditPayment={canEditPayments}
            onEditPayment={onEditPayment}
          />

          <BalanceDetailPagination
            page={page}
            totalPages={totalPages}
            total={data.total}
            perPage={limit}
            onPageChange={setPage}
          />
        </div>
      </div>

      <BalanceDetailReportFooter
        debtorTotal={totals.debt}
        creditorTotal={totals.payment}
        netTotal={totals.net}
      />

      <BalanceDetailTransactionModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      <BalanceDetailExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onConfirm={() => void runExcel()}
        busy={excelBusy}
      />
      <BalanceDetailColumnsModal
        open={columnsOpen}
        columns={columns}
        onChange={setColumns}
        onClose={() => setColumnsOpen(false)}
      />
      {balanceCards.length > 0 ? (
        <BalanceDetailOverallModal
          open={overallModalOpen}
          onClose={() => setOverallModalOpen(false)}
          cards={balanceCards}
          territory={customer?.territory}
        />
      ) : null}
    </div>
  );
}
