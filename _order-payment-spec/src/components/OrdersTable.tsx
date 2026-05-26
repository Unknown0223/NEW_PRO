import { useState } from 'react';
import type { Order } from '../types';
import StatusBadge from './StatusBadge';
import { formatNumber, parseNumber } from '../utils/format';

interface OrdersTableProps {
  orders: Order[];
  onUpdateOrder: (id: number, field: keyof Order, value: any) => void;
}

export default function OrdersTable({
  orders,
  onUpdateOrder,
}: OrdersTableProps) {
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleInputChange = (order: Order, field: keyof Order, value: string) => {
    const num = parseNumber(value);
    onUpdateOrder(order.id, field, num);
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-3 text-left font-medium text-slate-600">Названия</th>
            <th className="px-3 py-3 text-left font-medium text-slate-600">Заказ ID</th>
            <th className="px-3 py-3 text-left font-medium text-slate-600">Статус заказа</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Сумма заказа</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Остаток долга</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Наличные</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Доход от ...</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Терминал</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Наличны...</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Банковски...</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Риал</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600">Не оплачено</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="hover:bg-slate-50 transition-colors bg-teal-50/40"
            >
              <td className="px-3 py-2">
                <a
                  href={`/clients/${order.clientUuid}`}
                  className="text-teal-600 hover:underline font-medium"
                >
                  {order.clientName}
                </a>
              </td>
              <td className="px-3 py-2">
                <a
                  href={`/orders/details/${order.id}`}
                  className="text-slate-700 hover:text-teal-600 hover:underline"
                >
                  {order.id}
                </a>
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={order.status} />
              </td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(order.orderAmount)}</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(order.debt)}</td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.cash ? formatNumber(order.cash) : ''}
                  onChange={(e) => handleInputChange(order, 'cash', e.target.value)}
                  onFocus={() => setEditingId(order.id)}
                  onBlur={() => setEditingId(null)}
                  className={`w-28 px-2 py-1 text-right border rounded-md text-sm ${
                    editingId === order.id ? 'border-teal-400 ring-1 ring-teal-400' : 'border-slate-300'
                  }`}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.oldDebtIncome ? formatNumber(order.oldDebtIncome) : ''}
                  onChange={(e) => handleInputChange(order, 'oldDebtIncome', e.target.value)}
                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded-md text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.terminal ? formatNumber(order.terminal) : ''}
                  onChange={(e) => handleInputChange(order, 'terminal', e.target.value)}
                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded-md text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.tengeCash ? formatNumber(order.tengeCash) : ''}
                  onChange={(e) => handleInputChange(order, 'tengeCash', e.target.value)}
                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded-md text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.bankTransfer ? formatNumber(order.bankTransfer) : ''}
                  onChange={(e) => handleInputChange(order, 'bankTransfer', e.target.value)}
                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded-md text-sm"
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={order.rial ? formatNumber(order.rial) : ''}
                  onChange={(e) => handleInputChange(order, 'rial', e.target.value)}
                  className="w-28 px-2 py-1 text-right border border-slate-300 rounded-md text-sm"
                />
              </td>
              <td className={`px-3 py-2 text-right font-medium ${order.unpaid > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatNumber(order.unpaid)}
              </td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={12} className="px-3 py-12 text-center text-slate-400">
                Нет заказов со статусом "Доставлен"
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
