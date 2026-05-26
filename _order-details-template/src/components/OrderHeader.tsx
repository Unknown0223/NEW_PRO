import { ArrowLeft, Clock } from 'lucide-react';

interface OrderHeaderProps {
  orderId: string;
  onBack?: () => void;
  onViewHistory?: () => void;
}

export default function OrderHeader({ orderId, onBack, onViewHistory }: OrderHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          Заявка: {orderId}
        </h1>
      </div>
      <button
        onClick={onViewHistory}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Clock className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">История заказа</span>
      </button>
    </div>
  );
}
