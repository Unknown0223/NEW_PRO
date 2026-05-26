import { cn } from '../utils/cn';

interface StatusBadgeProps {
  status: string;
  statusKey?: 'NEW' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | string;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-700',
  CONFIRMED: 'bg-amber-100 text-amber-700',
  SHIPPED: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
};

export default function StatusBadge({ status, statusKey }: StatusBadgeProps) {
  if (!status) return null;

  const colorClass = statusKey
    ? statusColors[statusKey] || 'bg-gray-100 text-gray-700'
    : 'bg-gray-100 text-gray-700';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium',
        colorClass
      )}
    >
      {status}
    </span>
  );
}
