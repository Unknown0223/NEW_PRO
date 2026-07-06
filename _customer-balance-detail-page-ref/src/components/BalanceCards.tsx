import type { BalanceCard } from '../types';
import { fmtSom, fmtUZS } from '../utils/format';
import { cn } from '../utils/cn';

interface Props {
  cards: BalanceCard[];
  selected: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[12px] leading-6">
      <span className="text-gray-500">{label}:</span>
      <span className={cn('tabular font-medium', value < 0 ? 'text-red-600' : 'text-gray-700')}>
        {fmtUZS(value)}
      </span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="w-[280px] shrink-0 rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
      <div className="h-6 w-24 bg-gray-200 rounded mb-4" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-3 bg-gray-100 rounded" />)}
      </div>
    </div>
  );
}

export default function BalanceCards({ cards, selected, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-1">
        <SkeletonCard /><SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {cards.map((c) => {
        const active = selected === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-[280px] shrink-0 text-left rounded-lg bg-white transition-all',
              active
                ? 'border-2 border-[#1aa096] shadow-[0_0_0_3px_rgba(26,160,150,0.12)]'
                : 'border border-gray-200 hover:border-gray-300 hover:shadow-sm'
            )}
          >
            <div className="px-4 pt-3 pb-2.5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                  active ? 'bg-[#1aa096] border-[#1aa096]' : 'border-gray-300 bg-white'
                )}>
                  {active && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5.5L4 8L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-[13px] font-medium text-gray-600 truncate">{c.title}</span>
              </div>
              <div className={cn(
                'mt-1 pl-[26px] text-[20px] font-bold tabular leading-7',
                c.amount < 0 ? 'text-red-600' : 'text-gray-900'
              )}>
                {fmtSom(c.amount)}
              </div>
            </div>
            <div className="px-4 py-2.5">
              <Row label="Эски карздан кирим" value={c.oldDebtIncome} />
              <Row label="Naqd" value={c.cash} />
              <Row label="Pereches" value={c.transfer} />
              <Row label="Terminal" value={c.terminal} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
