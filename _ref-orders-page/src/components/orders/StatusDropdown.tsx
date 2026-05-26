import React, { useState, useRef, useEffect } from 'react';
import type { OrderStatus } from '@/types/order';

interface StatusDropdownProps {
  status: OrderStatus;
  onChange: (status: OrderStatus) => void;
  onAction?: (action: string) => void;
}

interface StatusStyle {
  bg: string;
  text: string;
  border: string;
}

const statusStyles: Record<OrderStatus, StatusStyle> = {
  NEW: { bg: '#bae6fd', text: '#0369a1', border: '#7dd3fc' },
  CONFIRMED: { bg: '#fef08a', text: '#854d0e', border: '#fde047' },
  SHIPPED: { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
  DELIVERED: { bg: '#bbf7d0', text: '#166534', border: '#86efac' },
  CANCELLED: { bg: '#e5e7eb', text: '#4b5563', border: '#d1d5db' },
  RETURN_NEW: { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  RETURN_SHIPPED: { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
  RETURN_DELIVERED: { bg: '#bbf7d0', text: '#166534', border: '#86efac' },
  RETURN_CANCELLED: { bg: '#e5e7eb', text: '#4b5563', border: '#d1d5db' },
  RETURN_IN_PROGRESS: { bg: '#f9a8d4', text: '#9d174d', border: '#f472b6' },
};

const statusLabels: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтвержден к отгрузке',
  SHIPPED: 'Отгружен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменен',
  RETURN_NEW: 'Новый возврат',
  RETURN_SHIPPED: 'Возврат отгружен',
  RETURN_DELIVERED: 'Возврат доставлен',
  RETURN_CANCELLED: 'Возврат отменен',
  RETURN_IN_PROGRESS: 'В процессе возврата',
};

type ActionType = 'action' | 'special' | 'text';

interface StatusAction {
  type: ActionType;
  label: string;
  value: string;
}

const getActionsForStatus = (current: OrderStatus): StatusAction[] => {
  switch (current) {
    case 'NEW':
      return [
        { type: 'action', label: 'Отменен', value: 'CANCELLED' },
        { type: 'action', label: 'Подтвердить к отгрузке', value: 'CONFIRMED' },
      ];
    case 'CONFIRMED':
      return [
        { type: 'special', label: 'Изменить ожидаемую дату отгрузки', value: 'change_ship_date' },
        { type: 'action', label: 'Отгружен', value: 'SHIPPED' },
      ];
    case 'SHIPPED':
      return [
        { type: 'action', label: 'Доставлен', value: 'DELIVERED' },
      ];
    case 'DELIVERED':
      return [
        { type: 'special', label: 'Возврат с полки по заказ', value: 'return_from_shelf' },
        { type: 'special', label: 'Изменить дату доставки', value: 'change_delivery_date' },
      ];
    case 'CANCELLED':
      return [
        { type: 'text', label: 'Нет доступных статусов', value: 'none' },
      ];
    case 'RETURN_IN_PROGRESS':
      return [
        { type: 'action', label: 'Подтвердить возврат', value: 'RETURN_DELIVERED' },
        { type: 'action', label: 'Отменить возврат', value: 'RETURN_CANCELLED' },
      ];
    default:
      return [];
  }
};

export const StatusDropdown: React.FC<StatusDropdownProps> = ({ status, onChange, onAction }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = getActionsForStatus(status);
  const style = statusStyles[status] || statusStyles.NEW;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isExpandable = actions.length > 0;
  const arrowUp = ['DELIVERED', 'CONFIRMED', 'SHIPPED', 'RETURN_IN_PROGRESS', 'RETURN_DELIVERED'].includes(status);
  const arrowDown = ['NEW', 'CANCELLED'].includes(status);
  const arrowChar = arrowUp ? '▲' : arrowDown ? '▼' : '▼';
  const label = statusLabels[status];

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => isExpandable && setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border whitespace-pre-line leading-tight ${
          isExpandable ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
        } transition-opacity`}
        style={{
          background: style.bg,
          color: style.text,
          borderColor: style.border,
        }}
      >
        <span className="text-[10px] font-bold">{arrowChar}</span>
        <span>{label}</span>
      </button>

      {open && isExpandable && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[260px] py-1 overflow-hidden">
          {actions.map((action, idx) => (
            <React.Fragment key={idx}>
              {action.type === 'special' ? (
                <button
                  type="button"
                  onClick={() => {
                    onAction?.(action.value);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-teal-50 transition-colors"
                >
                  {action.label}
                </button>
              ) : action.type === 'action' ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange(action.value as OrderStatus);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {action.label}
                </button>
              ) : (
                <div className="px-3 py-2.5 text-sm text-gray-400 cursor-default">
                  {action.label}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
