import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Refusal, RefusalFiltersState } from '../types/refusal';
import { mockRefusals } from '../data/mockRefusals';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import RefusalFilters from '../components/refusals/RefusalFilters';
import RefusalsTable from '../components/refusals/RefusalsTable';
import Pagination from '../components/refusals/Pagination';
import SearchInput from '../components/refusals/SearchInput';
import ExportButton from '../components/refusals/ExportButton';
import StatisticsBar from '../components/refusals/StatisticsBar';

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export default function RefusalsPage() {
  const [filters, setFilters] = useState<RefusalFiltersState>({
    dateFrom: '2026-05-26',
    dateTo: '2026-05-26',
    agent: '',
    reason: '',
    clientCategory: '',
    zone: '',
    region: '',
    city: '',
  });

  const [appliedFilters, setAppliedFilters] = useState<RefusalFiltersState>({
    dateFrom: '2026-05-26',
    dateTo: '2026-05-26',
    agent: '',
    reason: '',
    clientCategory: '',
    zone: '',
    region: '',
    city: '',
  });

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [refusals, setRefusals] = useState<Refusal[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [perPageOpen, setPerPageOpen] = useState(false);

  const shiftDate = (dir: 'prev' | 'next') => {
    const diff = dir === 'prev' ? -1 : 1;
    const newFrom = new Date(filters.dateFrom);
    newFrom.setDate(newFrom.getDate() + diff);
    const newTo = new Date(filters.dateTo);
    newTo.setDate(newTo.getDate() + diff);
    setFilters((f) => ({
      ...f,
      dateFrom: newFrom.toISOString().split('T')[0],
      dateTo: newTo.toISOString().split('T')[0],
    }));
  };

  // Simulate GET /refusals with params
  const fetchRefusals = useCallback(async () => {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 350));

    let data = [...mockRefusals];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.client.name.toLowerCase().includes(q) ||
          r.agent.name.toLowerCase().includes(q) ||
          r.agent.code.toLowerCase().includes(q) ||
          r.territory.toLowerCase().includes(q)
      );
    }

    // Applied filters
    if (appliedFilters.agent) {
      data = data.filter((r) => r.agent.id === appliedFilters.agent);
    }
    if (appliedFilters.reason) {
      data = data.filter((r) => r.reason === appliedFilters.reason);
    }
    if (appliedFilters.zone) {
      const zoneMap: Record<string, string> = {
        bozor: 'BOZOR',
        yangi_bozor: 'YANGI BOZOR',
        markaziy: 'MARKAZIY',
        shimol: 'SHIMOL',
        janub: 'JANUB',
      };
      data = data.filter(
        (r) =>
          r.territory.toLowerCase() ===
          (zoneMap[appliedFilters.zone] || appliedFilters.zone).toLowerCase()
      );
    }
    if (appliedFilters.dateFrom) {
      data = data.filter((r) => r.createdAt >= appliedFilters.dateFrom);
    }
    if (appliedFilters.dateTo) {
      data = data.filter((r) => r.createdAt <= appliedFilters.dateTo);
    }

    // Sort
    data.sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortKey === 'createdAt') { av = a.createdAt; bv = b.createdAt; }
      else if (sortKey === 'client') { av = a.client.name; bv = b.client.name; }
      else if (sortKey === 'agent') { av = a.agent.name; bv = b.agent.name; }
      else if (sortKey === 'reason') { av = a.reason; bv = b.reason; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    setRefusals(data);
    setLoading(false);
  }, [search, appliedFilters, sortKey, sortDir]);

  useEffect(() => {
    fetchRefusals();
  }, [fetchRefusals]);

  useEffect(() => {
    setPage(1);
  }, [search, appliedFilters, sortKey, sortDir]);

  const paginated = useMemo(
    () => refusals.slice((page - 1) * perPage, page * perPage),
    [refusals, page, perPage]
  );

  const handleSort = (key: string) => {
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleApply = () => setAppliedFilters({ ...filters });

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top header */}
        <Header />

        {/* Title row with date picker */}
        <div className="bg-white px-5 pt-4 pb-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-bold text-gray-900">Отказы</h1>

            {/* Date range navigator — positioned right like screenshot */}
            <div className="flex items-center gap-0 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden h-8">
              <button
                onClick={() => shiftDate('prev')}
                className="px-2 h-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border-r border-gray-200"
              >
                <ChevronLeft size={13} />
              </button>

              <div className="flex items-center gap-1.5 px-3">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                </svg>
                <span className="text-[11px] font-medium text-gray-500">Дата</span>
                <div className="relative">
                  <span className="text-[11px] text-gray-700 font-medium">
                    {formatDate(filters.dateFrom)}
                  </span>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </div>
                <span className="text-gray-400 text-xs">–</span>
                <div className="relative">
                  <span className="text-[11px] text-gray-700 font-medium">
                    {formatDate(filters.dateTo)}
                  </span>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                </div>
              </div>

              <button
                onClick={() => shiftDate('next')}
                className="px-2 h-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border-l border-gray-200"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <RefusalFilters
          filters={filters}
          onFiltersChange={setFilters}
          onApply={handleApply}
        />

        {/* Table card */}
        <div className="flex-1 overflow-hidden flex flex-col mx-4 my-3 bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Table toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 flex-shrink-0 flex-wrap">
            {/* Column visibility */}
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
              <SlidersHorizontal size={13} />
            </button>

            {/* Filter active indicator */}
            <button className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="7" y1="12" x2="17" y2="12" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
            </button>

            {/* Per page */}
            <div className="relative">
              <button
                onClick={() => setPerPageOpen((p) => !p)}
                onBlur={() => setTimeout(() => setPerPageOpen(false), 150)}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors min-w-[52px]"
              >
                <span>{perPage}</span>
                <ChevronDown size={11} className="text-gray-400" />
              </button>
              {perPageOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-30 py-1 min-w-[64px]">
                  {PER_PAGE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setPerPage(opt); setPage(1); setPerPageOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-teal-50 ${
                        perPage === opt ? 'text-teal-600 font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search input */}
            <SearchInput value={search} onChange={setSearch} />

            {/* Excel export */}
            <ExportButton />

            {/* Refresh */}
            <button
              onClick={fetchRefusals}
              title="Обновить"
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-teal-500' : ''} />
            </button>
          </div>

          {/* Statistics mini-bar */}
          <StatisticsBar refusals={refusals} total={refusals.length} />

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <RefusalsTable
              refusals={paginated}
              loading={loading}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
            />
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            perPage={perPage}
            total={refusals.length}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
