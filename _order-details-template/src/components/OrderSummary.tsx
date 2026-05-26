import { Package, Scale, Hash, DollarSign } from 'lucide-react';

interface OrderSummaryProps {
  summary: {
    totalVolume: number;
    totalWeight: number;
    totalQuantity: number;
    totalAmount: number;
  };
}

export default function OrderSummary({ summary }: OrderSummaryProps) {
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const summaryItems = [
    {
      icon: Package,
      iconBg: 'bg-green-500',
      value: summary.totalVolume,
      unit: 'м³',
      label: 'Общий объем',
      color: 'green'
    },
    {
      icon: Scale,
      iconBg: 'bg-red-500',
      value: summary.totalWeight,
      unit: 'кг',
      label: 'Общий вес',
      color: 'red'
    },
    {
      icon: Hash,
      iconBg: 'bg-orange-500',
      value: summary.totalQuantity,
      unit: 'шт',
      label: 'Общий количество',
      color: 'orange'
    },
    {
      icon: DollarSign,
      iconBg: 'bg-teal-500',
      value: formatMoney(summary.totalAmount),
      unit: "So'm",
      label: 'Общая сумма',
      color: 'teal'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {summaryItems.map((item, index) => (
        <div
          key={index}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center justify-center"
        >
          <div className={`w-12 h-12 ${item.iconBg} rounded-xl flex items-center justify-center mb-3`}>
            <item.icon className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {item.value}
              <span className="text-sm font-normal text-gray-500 ml-1">{item.unit}</span>
            </p>
            <p className="text-sm text-gray-500 mt-1">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
