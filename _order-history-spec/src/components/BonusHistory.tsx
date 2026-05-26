import type { BonusEntry } from '../data/mockData';

interface BonusHistoryProps {
  data: BonusEntry[];
}

export default function BonusHistory({ data }: BonusHistoryProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-base font-bold text-gray-800">История бонусов</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                Дата
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                Название бонуса
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                Продукт
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                Кол-во
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">
                Действие
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">
                Исполнитель
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((bonus) => (
              <tr key={bonus.id} className="border-b border-gray-100 last:border-b-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                  {bonus.date}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">{bonus.bonusName}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{bonus.product}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{bonus.quantity}</td>
                <td className="px-4 py-3 text-xs text-gray-700">{bonus.action}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-600">
                  {bonus.user}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
