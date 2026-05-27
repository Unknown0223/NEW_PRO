import { useNavigate } from 'react-router-dom';
import { Refusal } from '../../types/refusal';
import { REFUSAL_REASON_LABELS } from '../../data/mockRefusals';
import { Copy, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface RefusalsTableProps {
  refusals: Refusal[];
  loading: boolean;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

interface ThProps {
  label: string;
  sKey?: string;
  currentSort: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

function Th({ label, sKey, currentSort, sortDir, onSort, className, align = 'left' }: ThProps) {
  const active = sKey && currentSort === sKey;
  return (
    <th
      onClick={() => sKey && onSort(sKey)}
      className={`px-4 py-2.5 text-xs font-semibold text-gray-500 tracking-wide whitespace-nowrap select-none bg-gray-50 ${
        sKey ? 'cursor-pointer hover:text-gray-700 hover:bg-gray-100' : ''
      } ${align === 'right' ? 'text-right' : 'text-left'} ${className || ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sKey && (
          active ? (
            sortDir === 'asc' ? (
              <ArrowUp size={11} className="text-teal-500" />
            ) : (
              <ArrowDown size={11} className="text-teal-500" />
            )
          ) : (
            <ArrowUpDown size={11} className="text-gray-300" />
          )
        )}
      </span>
    </th>
  );
}

function TerritoryBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
      {label}
    </span>
  );
}

function ReasonText({ reason }: { reason: string }) {
  const label = REFUSAL_REASON_LABELS[reason] || reason;

  // Extract just text color for inline display (like the screenshot — just plain text)
  const textColors: Record<string, string> = {
    stock_enough: 'text-gray-700',
    client_closed: 'text-gray-500',
    no_money: 'text-red-600',
    competitor: 'text-orange-600',
    later: 'text-blue-600',
  };

  return (
    <span className={`text-xs ${textColors[reason] || 'text-gray-700'}`}>
      {label}
    </span>
  );
}

// Copy to clipboard button
function CopyBtn({ text }: { text: string }) {
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center justify-center w-5 h-5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
      title="Скопировать"
    >
      <Copy size={11} />
    </button>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[110, 200, 280, 340, 100].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-3.5 bg-gray-100 rounded animate-pulse"
            style={{ width: `${Math.min(w, 200)}px`, maxWidth: '100%' }}
          />
        </td>
      ))}
    </tr>
  );
}

// Mobile card view
function MobileCard({ refusal, navigate }: { refusal: Refusal; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => navigate(`/clients/about-clients/${refusal.client.id}`)}
          className="text-teal-600 hover:text-teal-700 font-semibold text-sm flex items-center gap-1 text-left"
        >
          {refusal.client.name}
          <CopyBtn text={refusal.client.name} />
        </button>
        <TerritoryBadge label={refusal.territory} />
      </div>
      <ReasonText reason={refusal.reason} />
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={() => navigate(`/users/${refusal.agent.id}`)}
          className="text-teal-600 hover:text-teal-700 text-xs text-left truncate"
        >
          {refusal.agent.code} - [{refusal.agent.name}]
        </button>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {refusal.createdAt.replace(/-/g, '.')}
        </span>
      </div>
    </div>
  );
}

export default function RefusalsTable({
  refusals,
  loading,
  sortKey,
  sortDir,
  onSort,
}: RefusalsTableProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <table className="w-full border-collapse min-w-[800px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <Th
                label="Дата"
                sKey="createdAt"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="w-[105px] border-b border-gray-200"
              />
              <Th
                label="Клиенты"
                sKey="client"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-[200px] border-b border-gray-200"
              />
              <Th
                label="Причины отказа"
                sKey="reason"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-[260px] border-b border-gray-200"
              />
              <Th
                label="Агент"
                sKey="agent"
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-[300px] border-b border-gray-200"
              />
              <Th
                label="Территория"
                sKey=""
                currentSort={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
                className="w-[130px] border-b border-gray-200"
              />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
              : refusals.map((refusal, idx) => (
                  <tr
                    key={refusal.id}
                    className={`border-b border-gray-100 group hover:bg-teal-50/40 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    }`}
                  >
                    {/* Date */}
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap font-mono">
                      {refusal.createdAt.replace(/-/g, '.')}
                    </td>

                    {/* Client */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => navigate(`/clients/about-clients/${refusal.client.id}`)}
                          className="text-teal-600 hover:text-teal-700 hover:underline font-medium text-sm leading-tight text-left"
                        >
                          {refusal.client.name}
                        </button>
                        <CopyBtn text={refusal.client.name} />
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-2.5">
                      <ReasonText reason={refusal.reason} />
                    </td>

                    {/* Agent */}
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => navigate(`/users/${refusal.agent.id}`)}
                        className="text-teal-600 hover:text-teal-700 hover:underline text-xs text-left leading-tight"
                      >
                        {refusal.agent.code} - [{refusal.agent.name}]
                      </button>
                    </td>

                    {/* Territory */}
                    <td className="px-4 py-2.5 text-right">
                      <TerritoryBadge label={refusal.territory} />
                    </td>
                  </tr>
                ))}

            {/* Empty state */}
            {!loading && refusals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm text-gray-400">Нет данных</p>
                    <p className="text-xs text-gray-300">Попробуйте изменить фильтры</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden flex flex-col gap-3 p-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />
            ))
          : refusals.map((r) => (
              <MobileCard key={r.id} refusal={r} navigate={navigate} />
            ))}
        {!loading && refusals.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">Нет данных</div>
        )}
      </div>
    </>
  );
}
