import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import CustomerHeader from './components/CustomerHeader';
import BalanceCards from './components/BalanceCards';
import Toolbar from './components/Toolbar';
import FilterPanel from './components/FilterPanel';
import LedgerTable, { allColumns, type ColumnDef } from './components/LedgerTable';
import Pagination from './components/Pagination';
import ReportFooter from './components/ReportFooter';
import { ExportModal, OverallBalanceModal, TransactionModal, type ExportMode } from './components/Modals';
import { fetchDetails, fetchExportRows, type QueryParams } from './api';
import { allTransactions, balanceCards, customer } from './data';
import { emptyFilters, type DebtTransaction, type Filters, type SortDir, type SortField, type ViewTab } from './types';
import { exportToExcel } from './utils/excel';
import { cn } from './utils/cn';

export default function App() {
  // ---- view state
  const [tab, setTab] = useState<ViewTab>('overall');
  const [selectedCard, setSelectedCard] = useState<string | null>('agent-set');
  const [showOverallModal, setShowOverallModal] = useState(false);

  // ---- query state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showSystem, setShowSystem] = useState(false);

  // ---- data state
  const [rows, setRows] = useState<DebtTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState({ debt: 0, payment: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardsLoading, setCardsLoading] = useState(false);

  // ---- modal state
  const [selectedTx, setSelectedTx] = useState<DebtTransaction | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ---- columns
  const [columns, setColumns] = useState<ColumnDef[]>(allColumns);

  const params: QueryParams = useMemo(
    () => ({ page, perPage, search, sortField, sortDir, filters, showSystem }),
    [page, perPage, search, sortField, sortDir, filters, showSystem]
  );

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'search' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'search') setSearching(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchDetails(params);
      setRows(res.rows);
      setTotal(res.total);
      setTotals({ debt: res.totalDebt, payment: res.totalPayment, net: res.netBalance });
    } catch {
      setError('Не удалось получить данные с сервера (GET /customer-balance/details)');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSearching(false);
    }
  }, [params]);

  useEffect(() => { load(search ? 'search' : 'initial'); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // reset page on query change
  useEffect(() => { setPage(1); }, [search, filters, perPage, showSystem, tab]);

  const refreshAll = async () => {
    setCardsLoading(true);
    setRefreshing(true);
    await load('refresh');
    setTimeout(() => setCardsLoading(false), 500);
  };

  const onSort = (f: SortField) => {
    if (f === sortField) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else { setSortField(f); setSortDir('desc'); }
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.types.length) n++;
    if (filters.paymentMethods.length) n++;
    if (filters.agents.length) n++;
    if (filters.expeditors.length) n++;
    if (filters.consignment) n++;
    if (filters.cashbox) n++;
    if (filters.comment) n++;
    if (filters.createdBy) n++;
    if (filters.debtMin || filters.debtMax) n++;
    if (filters.paymentMin || filters.paymentMax) n++;
    if (filters.dateFrom || filters.dateTo) n++;
    return n;
  }, [filters]);

  const doExport = async (mode: ExportMode) => {
    setExporting(true);
    try {
      const data = await fetchExportRows(params, mode);
      exportToExcel(data, `customer-balance_KARZINKA_${mode}_${new Date().toISOString().slice(0, 10)}.csv`);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#eef1f4] text-gray-900">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 p-6 space-y-6">
          {/* SECTION 1: Customer header */}
          <CustomerHeader
            customer={customer}
            showOverall={showOverallModal}
            onToggleOverall={(v) => setShowOverallModal(v)}
            onRefresh={refreshAll}
            refreshing={refreshing}
          />

          {/* SECTION 2: Balance summary cards */}
          <BalanceCards
            cards={balanceCards}
            selected={selectedCard}
            onSelect={(id) => setSelectedCard(id === selectedCard ? null : id)}
            loading={cardsLoading}
          />

          {/* SECTION 3-8: Tabs + table card */}
          <div>
            {/* View switcher */}
            <div className="flex">
              {([['overall', 'Общий'], ['detailed', 'Подробно']] as [ViewTab, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setTab(v)}
                  className={cn(
                    'h-10 px-6 text-[13px] font-medium rounded-t-lg border border-b-0 -mb-px transition-colors',
                    tab === v
                      ? 'bg-white text-[#1aa096] border-gray-200 relative z-10'
                      : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-lg rounded-tl-none border border-gray-200">
              <Toolbar
                tab={tab}
                perPage={perPage}
                onPerPage={setPerPage}
                search={search}
                onSearch={setSearch}
                searching={searching}
                onExcel={() => setExportOpen(true)}
                onRefresh={() => load('refresh')}
                refreshing={refreshing}
                filtersOpen={filtersOpen}
                onToggleFilters={() => setFiltersOpen(!filtersOpen)}
                activeFilterCount={activeFilterCount}
                dateFrom={filters.dateFrom}
                dateTo={filters.dateTo}
                onDateFrom={(v) => setFilters({ ...filters, dateFrom: v })}
                onDateTo={(v) => setFilters({ ...filters, dateTo: v })}
                showSystem={showSystem}
                onShowSystem={setShowSystem}
                sortDir={sortDir}
                onToggleSortDir={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                columns={columns.filter((c) => c.tabs.includes(tab)).map(({ key, label, visible }) => ({ key, label, visible }))}
                onToggleColumn={(key) =>
                  setColumns(columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)))
                }
              />

              {filtersOpen && (
                <FilterPanel filters={filters} onChange={setFilters} onClose={() => setFiltersOpen(false)} />
              )}

              <LedgerTable
                tab={tab}
                rows={rows}
                loading={loading}
                error={error}
                columns={columns}
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                onRowClick={setSelectedTx}
                onRetry={() => load()}
                perPage={perPage}
              />

              <Pagination page={page} perPage={perPage} total={total} onPage={setPage} />
            </div>
          </div>

          {/* SECTION 9: Report footer */}
          <ReportFooter totalDebt={totals.debt} totalPayment={totals.payment} netBalance={totals.net} />
        </main>
      </div>

      {/* MODALS */}
      {selectedTx && <TransactionModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      {exportOpen && (
        <ExportModal
          onClose={() => setExportOpen(false)}
          onExport={doExport}
          exporting={exporting}
          counts={{ page: rows.length, filtered: total, full: allTransactions.length }}
        />
      )}
      {showOverallModal && <OverallBalanceModal cards={balanceCards} onClose={() => setShowOverallModal(false)} />}
    </div>
  );
}
