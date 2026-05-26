import type { PaymentStatistics } from '../types';
import { formatNumber } from '../utils/format';

interface StatisticsRowProps {
  statistics: PaymentStatistics;
}

interface StatCell {
  label: string;
  value: number;
  className?: string;
}

export default function StatisticsRow({ statistics }: StatisticsRowProps) {
  const leftStats: StatCell[] = [
    { label: 'Общая сумма:', value: statistics.total, className: 'font-medium' },
    { label: 'Получено:', value: statistics.received, className: 'font-medium text-teal-700' },
    { label: 'Общий долг по заказам:', value: statistics.totalDebt, className: 'font-medium' },
    {
      label: 'Осталось:',
      value: statistics.remaining,
      className: 'font-medium text-red-600',
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm">
      {leftStats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5">
          <span className="text-slate-500">{stat.label}</span>
          <span className={stat.className || 'text-slate-700'}>{formatNumber(stat.value)}</span>
        </div>
      ))}
    </div>
  );
}
