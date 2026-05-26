import { useState } from 'react';

interface BonusItem {
  id: string;
  name: string;
  quantity: number;
  amount: number;
}

interface BonusSectionProps {
  bonuses: BonusItem[];
  autoBonus: boolean;
  totalBonusAmount: number;
}

export default function BonusSection({ bonuses, autoBonus, totalBonusAmount }: BonusSectionProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'bonuses'>('summary');

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Итог по заказом
        </button>
        <button
          onClick={() => setActiveTab('bonuses')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'bonuses'
              ? 'bg-teal-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          Бонусы
        </button>
      </div>

      {/* Auto Bonus Badge */}
      {autoBonus && (
        <div className="px-4 py-2 bg-green-50 border-b border-gray-100">
          <span className="text-xs font-medium text-green-700">✓ Авто бонус включен</span>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {activeTab === 'summary' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Prokladki</span>
              <div className="flex items-center gap-4">
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                  {bonuses.reduce((sum, b) => sum + b.quantity, 0)} шт
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatMoney(totalBonusAmount)} So'm
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">Скидка</span>
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                0.00%
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
              <span>Название</span>
              <span>Кол-во</span>
              <span>Сумма</span>
            </div>
            {bonuses.map((bonus) => (
              <div key={bonus.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-900">{bonus.name}</span>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-xs font-medium">
                  {bonus.quantity}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {formatMoney(bonus.amount)} So'm
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 border-t border-gray-100 mt-2">
              <span className="text-sm font-semibold text-gray-900">Итоги</span>
              <div className="flex items-center gap-4">
                <span className="px-2 py-0.5 bg-teal-600 text-white rounded text-xs font-medium">
                  {bonuses.reduce((sum, b) => sum + b.quantity, 0)}
                </span>
                <span className="px-3 py-1 bg-teal-600 text-white rounded text-xs font-medium">
                  {formatMoney(totalBonusAmount)} So'm
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
