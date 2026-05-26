import React from 'react';
import type { OrderStatus } from '@/types/order';

interface StatusBadgeProps {
  status: OrderStatus;
  editable?: boolean;
  onClick?: () => void;
}

const statusStyles: Record<OrderStatus, { bg: string; text: string; border: string; icon: string }> = {
  NEW: {
    bg: '#bae6fd',
    text: '#0369a1',
    border: '#7dd3fc',
    icon: '▼',
  },
  CONFIRMED: {
    bg: '#fef08a',
    text: '#854d0e',
    border: '#fde047',
    icon: '▼',
  },
  SHIPPED: {
    bg: '#fed7aa',
    text: '#9a3412',
    border: '#fdba74',
    icon: '▼',
  },
  DELIVERED: {
    bg: '#bbf7d0',
    text: '#166534',
    border: '#86efac',
    icon: '✔',
  },
  CANCELLED: {
    bg: '#e5e7eb',
    text: '#4b5563',
    border: '#d1d5db',
    icon: '▼',
  },
  RETURN_NEW: {
    bg: '#fce7f3',
    text: '#9d174d',
    border: '#f9a8d4',
    icon: '▼',
  },
  RETURN_SHIPPED: {
    bg: '#fed7aa',
    text: '#9a3412',
    border: '#fdba74',
    icon: '▼',
  },
  RETURN_DELIVERED: {
    bg: '#bbf7d0',
    text: '#166534',
    border: '#86efac',
    icon: '✔',
  },
  RETURN_CANCELLED: {
    bg: '#e5e7eb',
    text: '#4b5563',
    border: '#d1d5db',
    icon: '▼',
  },
  RETURN_IN_PROGRESS: {
    bg: '#f9a8d4',
    text: '#9d174d',
    border: '#f472b6',
    icon: '▼',
  },
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

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, editable, onClick }) => {
  const style = statusStyles[status] || statusStyles.NEW;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!editable}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
        editable ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
      } transition-opacity whitespace-pre-line leading-tight`}
      style={{
        background: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      <span className="text-[10px] font-bold">{style.icon}</span>
      <span>{statusLabels[status]}</span>
    </button>
  );
};
