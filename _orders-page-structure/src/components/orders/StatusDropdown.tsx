import React, { useState, useRef, useEffect } from 'react';
import type { OrderStatus, OrderType } from '@/types/order';
import { getStatusActions } from '@/utils/orderStatusLogic';

interface StatusDropdownProps {
  status: OrderStatus;
  orderType?: OrderType;
  onChange: (status: OrderStatus) => void;
  onAction?: (action: string) => void;
}

const statusStyles: Record<OrderStatus, { bg: string; text: string; border: string }> = {
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

const statusIcons: Record<OrderStatus, string> = {
  NEW: '▼',
  CONFIRMED: '▼',
  SHIPPED: '▲',
  DELIVERED: '✔',
  CANCELLED: '▼',
  RETURN_NEW: '▼',
  RETURN_SHIPPED: '▲',
  RETURN_DELIVERED: '✔',
  RETURN_CANCELLED: '▼',
  RETURN_IN_PROGRESS: '▼',
};

export const StatusDropdown: React.FC<StatusDropdownProps> = ({
  status,
  orderType = 'ORDER',
  onChange,
  onAction,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actions = getStatusActions(status, orderType);
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

  const isExpandable = actions.length > 0 && actions.some(a => a.type !== 'info');
  const label = statusLabels[status];
  const icon = statusIcons[status];

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
        <span className="text-[10px] font-bold">{icon}</span>
        <span>{label}</span>
      </button>

      {open && isExpandable && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[280px] py-1 overflow-hidden">
          {actions.map((action, idx) => (
            <div key={idx}>
              {action.type === 'transition' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (action.requiresConfirmation) {
                      if (confirm(`${action.label}?\n\n${action.description}`)) {
                        action.targetStatus && onChange(action.targetStatus);
                      }
                    } else {
                      action.targetStatus && onChange(action.targetStatus);
                    }
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  title={action.description}
                >
                  {action.label}
                </button>
              ) : action.type === 'special' ? (
                <button
                  type="button"
                  onClick={() => {
                    onAction?.(action.actionCode || '');
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-teal-50 transition-colors"
                  title={action.description}
                >
                  {action.label}
                </button>
              ) : (
                <div className="px-3 py-2.5 text-sm text-gray-400 cursor-default">
                  {action.label}
                </div>
              )}
              {idx < actions.length - 1 && action.type === 'transition' && (
                <div className="mx-3 border-t border-gray-100" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
