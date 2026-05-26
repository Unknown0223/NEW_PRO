import { ChevronDown, CheckCircle } from 'lucide-react';

type OrderStatus = 'Новый' | 'Подтвержден' | 'Отгружен' | 'Доставлен' | 'Отменен';

interface StatusSectionProps {
  status: OrderStatus;
  editable?: boolean;
  onStatusChange?: (status: OrderStatus) => void;
}

const statusColors: Record<OrderStatus, string> = {
  'Новый': 'bg-blue-100 text-blue-700 border-blue-200',
  'Подтвержден': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Отгружен': 'bg-purple-100 text-purple-700 border-purple-200',
  'Доставлен': 'bg-green-100 text-green-700 border-green-200',
  'Отменен': 'bg-red-100 text-red-700 border-red-200'
};

const statusOptions: OrderStatus[] = ['Новый', 'Подтвержден', 'Отгружен', 'Доставлен', 'Отменен'];

export default function StatusSection({ status, editable = false, onStatusChange }: StatusSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Заказ</span>
        </div>
        {editable ? (
          <div className="relative">
            <select
              value={status}
              onChange={(e) => onStatusChange?.(e.target.value as OrderStatus)}
              className={`px-4 py-2 pr-10 rounded-lg text-sm font-medium border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${statusColors[status]}`}
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
          </div>
        ) : (
          <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${statusColors[status]}`}>
            ✓ {status}
          </span>
        )}
      </div>
    </div>
  );
}
