import type { OrderStatus } from '../types';

const statusColors: Record<OrderStatus, string> = {
  'Новый': 'bg-slate-200 text-slate-700',
  'Подтвержден': 'bg-blue-100 text-blue-700',
  'Отгружен': 'bg-orange-100 text-orange-700',
  'Доставлен': 'bg-green-100 text-green-700',
  'Отменен': 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${statusColors[status]}`}>
      {status}
    </span>
  );
}
