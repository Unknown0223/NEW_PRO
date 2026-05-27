import { Refusal } from '../../types/refusal';
import { REFUSAL_REASON_LABELS } from '../../data/mockRefusals';
import { TrendingDown } from 'lucide-react';

interface StatisticsBarProps {
  refusals: Refusal[];
  total: number;
}

const reasonColors: Record<string, { dot: string; text: string }> = {
  stock_enough: { dot: 'bg-yellow-400', text: 'text-yellow-700' },
  client_closed: { dot: 'bg-gray-400', text: 'text-gray-600' },
  no_money: { dot: 'bg-red-500', text: 'text-red-700' },
  competitor: { dot: 'bg-orange-500', text: 'text-orange-700' },
  later: { dot: 'bg-blue-400', text: 'text-blue-700' },
};

export default function StatisticsBar({ refusals, total }: StatisticsBarProps) {
  const counts: Record<string, number> = {};
  refusals.forEach((r) => {
    counts[r.reason] = (counts[r.reason] || 0) + 1;
  });

  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 bg-gray-50/80 border-b border-gray-100 text-xs flex-shrink-0">
      {/* Total */}
      <div className="flex items-center gap-1.5">
        <TrendingDown size={13} className="text-teal-500" />
        <span className="text-gray-500 font-medium">Всего отказов:</span>
        <span className="font-bold text-teal-600 text-sm">{total}</span>
      </div>

      {/* Separator */}
      {items.length > 0 && <div className="w-px h-3.5 bg-gray-300" />}

      {/* By reason */}
      {items.map(([reason, count]) => {
        const colors = reasonColors[reason] || { dot: 'bg-gray-400', text: 'text-gray-600' };
        return (
          <div key={reason} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
            <span className={`${colors.text} font-medium`}>
              {REFUSAL_REASON_LABELS[reason]}:
            </span>
            <span className="font-bold text-gray-700">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
