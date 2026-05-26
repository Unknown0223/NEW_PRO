import React, { useState } from 'react';
import { Package, Globe, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/Checkbox';
import { StatusDropdown } from './StatusDropdown';
import { useToast } from '@/components/ui/Toast';
import type { Order, OrderStatus, OrderSource } from '@/types/order';

interface OrdersTableProps {
  orders: Order[];
  selectedRows: Set<string>;
  onSelectRow: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onStatusChange: (id: string, status: OrderStatus) => void;
  onAction: (orderId: string, action: string) => void;
  onRowClick: (id: string) => void;
}

const CopyIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// Get source dynamically from order id (web for even ids, phone for odd)
const getSource = (order: Order): OrderSource => {
  if (order.source) return order.source;
  const num = parseInt(order.id.replace(/\D/g, '') || '0');
  return num % 2 === 0 ? 'web' : 'phone';
};

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  selectedRows,
  onSelectRow,
  onSelectAll,
  onStatusChange,
  onAction,
  onRowClick,
}) => {
  const toast = useToast();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const allSelected = orders.length > 0 && orders.every((o) => selectedRows.has(o.id));
  const someSelected = orders.some((o) => selectedRows.has(o.id)) && !allSelected;

  const handleCopy = async (e: React.MouseEvent, text: string, label = 'Скопировано') => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast.show(`${label}: ${text}`, 'success');
    } catch {
      toast.show('Не удалось скопировать', 'error');
    }
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-gray-200">
              <th className="w-8 py-2.5 px-2">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onChange={() => onSelectAll(!allSelected)}
                />
              </th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">№</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Исходный заказ</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Источник заявки</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Тип</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Дата заказа</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Ожидаемая<br />дата отгрузки</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Дата<br />отгрузки</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Дата<br />доставки</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Дата<br />возврата</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Дата<br />создания</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Статус</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Клиент</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Юр. наз. клиента</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Ид клиента</th>
              <th className="py-2.5 px-2 text-left font-medium text-gray-500">Телефон</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const isSelected = selectedRows.has(order.id);
              const isExpanded = expandedRows.has(order.id);
              const source = getSource(order);
              return (
                <React.Fragment key={order.id}>
                  <tr
                    onClick={() => onRowClick(order.id)}
                    className={`border-b border-gray-100 transition-colors group cursor-pointer ${
                      isSelected || isExpanded ? 'bg-[#e0f7f6]' : 'hover:bg-[#f0fdfc]'
                    }`}
                  >
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onChange={(checked) => onSelectRow(order.id, checked)}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5">
                        {/* Source icon: globus or phone */}
                        <span
                          className="text-gray-500 flex-shrink-0"
                          title={source === 'web' ? 'Создан с веба' : 'Создан с телефона'}
                        >
                          {source === 'web' ? (
                            <Globe className="w-3.5 h-3.5" />
                          ) : (
                            <Smartphone className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRowClick(order.id);
                          }}
                          className="text-teal-700 hover:underline font-medium"
                        >
                          {order.number}
                        </button>
                        <button
                          onClick={(e) => handleCopy(e, order.number, '№ заказа')}
                          className="text-teal-500 hover:text-teal-700 opacity-60 hover:opacity-100 transition-opacity p-0.5"
                          title="Копировать номер"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                        {/* Expand chevron */}
                        <button
                          onClick={(e) => toggleExpand(e, order.id)}
                          className="text-gray-400 hover:text-teal-600 ml-0.5 p-0.5 rounded hover:bg-teal-100 transition-colors"
                          title={isExpanded ? 'Свернуть' : 'Развернуть товары'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-gray-700">
                      {order.sourceOrder ? (
                        <div className="flex items-center gap-1">
                          <span className="text-teal-700 hover:underline cursor-pointer">
                            {order.sourceOrder}
                          </span>
                          <button
                            onClick={(e) => handleCopy(e, order.sourceOrder || '', 'Исх. заказ')}
                            className="text-teal-500 opacity-60 hover:opacity-100 p-0.5"
                          >
                            <CopyIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-gray-700">
                      <span className="text-gray-400">-</span>
                    </td>
                    <td className="py-2.5 px-2">
                      {order.type !== 'ORDER' ? (
                        <div className="text-[#7c2d12] leading-tight">
                          <div>Возврат с</div>
                          <div>полки по</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span>заказу</span>
                            {order.sourceOrder && (
                              <span className="flex items-center gap-1">
                                <span className="text-teal-700">({order.sourceOrder})</span>
                                <button
                                  onClick={(e) => handleCopy(e, order.sourceOrder || '', 'Заказ')}
                                  className="text-teal-500 opacity-60 hover:opacity-100 p-0.5"
                                >
                                  <CopyIcon className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-700">Заказ</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.createdAt}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.expectedShipDate || ''}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.shipDate || ''}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.deliveryDate || ''}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.returnDate || ''}</td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.createdAt}</td>
                    <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        status={order.status}
                        orderType={order.type}
                        onChange={(status) => onStatusChange(order.id, status)}
                        onAction={(action) => onAction(order.id, action)}
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1">
                        <span className="text-teal-700 hover:underline cursor-pointer font-medium">
                          {order.client}
                        </span>
                        <button
                          onClick={(e) => handleCopy(e, order.client, 'Клиент')}
                          className="text-teal-500 opacity-60 hover:opacity-100 p-0.5"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">{order.clientLegalName}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">{order.clientId}</span>
                        <button
                          onClick={(e) => handleCopy(e, order.clientId, 'ID клиента')}
                          className="text-teal-500 opacity-60 hover:opacity-100 p-0.5"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span className="text-gray-700">{order.phone}</span>
                        <button
                          onClick={(e) => handleCopy(e, order.phone, 'Телефон')}
                          className="text-teal-500 opacity-60 hover:opacity-100 p-0.5"
                        >
                          <CopyIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded products row */}
                  {isExpanded && (
                    <tr className="bg-[#f0fdfc] border-b border-gray-200">
                      <td colSpan={16} className="p-0">
                        <div className="px-6 py-4 animate-expand">
                          <div className="inline-flex items-center px-3 py-1.5 bg-teal-100 text-teal-800 text-sm font-medium rounded-md mb-3">
                            {order.products[0]?.name?.split(' ')[0] || 'Товары'}
                          </div>
                          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-medium text-gray-600">Ассортимент</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Цена</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Блок</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Кол-во</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Объем</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Скидка</th>
                                  <th className="text-right py-2 px-3 font-medium text-gray-600">Общая</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.products.map((product) => (
                                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 px-3 text-gray-900">{product.name}</td>
                                    <td className="py-2 px-3 text-right text-gray-700">
                                      {product.price.toLocaleString('ru-RU')}
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-700">
                                      {Math.ceil(product.qty / 4)}
                                    </td>
                                    <td className="py-2 px-3 text-right text-gray-700">{product.qty}</td>
                                    <td className="py-2 px-3 text-right text-gray-700">0</td>
                                    <td className="py-2 px-3 text-right text-gray-700">{product.discount} %</td>
                                    <td className="py-2 px-3 text-right text-gray-900 font-medium">
                                      {product.total.toLocaleString('ru-RU')}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-gray-50 font-semibold">
                                  <td className="py-2.5 px-3 text-gray-900">Итого</td>
                                  <td className="py-2.5 px-3" />
                                  <td className="py-2.5 px-3 text-right text-gray-900">
                                    {order.products.reduce((s, p) => s + Math.ceil(p.qty / 4), 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-900">
                                    {order.products.reduce((s, p) => s + p.qty, 0)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-900">0</td>
                                  <td className="py-2.5 px-3" />
                                  <td className="py-2.5 px-3 text-right text-teal-700">
                                    {order.products.reduce((s, p) => s + p.total, 0).toLocaleString('ru-RU')}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {orders.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">Заказы не найдены</p>
          <p className="text-sm">Измените фильтры или создайте новый заказ</p>
        </div>
      )}
    </div>
  );
};
