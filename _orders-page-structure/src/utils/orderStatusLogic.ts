import type { OrderStatus, OrderType } from '@/types/order';

// ============================================================
// STATUS OQIMLARI (Status Flow Diagrams)
// ============================================================

/**
 * ODDIY ZAKAZ (ORDER) STATUS OQIMI:
 * 
 * NEW (Новый)
 *   ├── Подтвердить к отгрузке ──→ CONFIRMED
 *   │                               ├── Отгружен ──→ SHIPPED
 *   │                               │                  └── Доставлен ──→ DELIVERED
 *   │                               │                                        └── Возврат с полки по заказ ──→ RETURN_IN_PROGRESS
 *   │                               └── Отменен ──→ CANCELLED
 *   └── Отменен ──→ CANCELLED
 */

/**
 * ВОЗВРАТ С ПОЛКИ (RETURN) STATUS OQIMI:
 * 
 * RETURN_NEW (Новый возврат)
 *   ├── Подтвердить ──→ RETURN_SHIPPED (Возврат отгружен)
 *   │                    └── Доставлен ──→ RETURN_DELIVERED (Возврат доставлен)
 *   └── Отменить ──→ RETURN_CANCELLED (Возврат отменен)
 */

/**
 * ВОЗВРАТ ПО ЗАКАЗУ (RETURN_BY_ORDER) STATUS OQIMI:
 * 
 * Bu aslida ORDER tipidagi zakazning DELIVERED holatidan boshlanadi:
 * 
 * DELIVERED (Доставлен)
 *   └── Возврат с полки по заказ ──→ RETURN_IN_PROGRESS (В процессе возврата)
 *                                      ├── Подтвердить возврат ──→ DELIVERED (qaytarildi)
 *                                      └── Отменить возврат ──→ CANCELLED
 */

// ============================================================
// STATUS MA'LUMOTLARI
// ============================================================

export const statusInfo: Record<OrderStatus, {
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: 'up' | 'down' | 'check' | 'x';
  category: 'order' | 'return';
}> = {
  // ORDER statuses
  NEW: {
    label: 'Новый',
    shortLabel: 'Новый',
    color: '#0369a1',
    bgColor: '#bae6fd',
    borderColor: '#7dd3fc',
    icon: 'down',
    category: 'order',
  },
  CONFIRMED: {
    label: 'Подтвержден к отгрузке',
    shortLabel: 'Подтв. к отгрузке',
    color: '#854d0e',
    bgColor: '#fef08a',
    borderColor: '#fde047',
    icon: 'down',
    category: 'order',
  },
  SHIPPED: {
    label: 'Отгружен',
    shortLabel: 'Отгружен',
    color: '#9a3412',
    bgColor: '#fed7aa',
    borderColor: '#fdba74',
    icon: 'up',
    category: 'order',
  },
  DELIVERED: {
    label: 'Доставлен',
    shortLabel: 'Доставлен',
    color: '#166534',
    bgColor: '#bbf7d0',
    borderColor: '#86efac',
    icon: 'check',
    category: 'order',
  },
  CANCELLED: {
    label: 'Отменен',
    shortLabel: 'Отменен',
    color: '#4b5563',
    bgColor: '#e5e7eb',
    borderColor: '#d1d5db',
    icon: 'x',
    category: 'order',
  },
  RETURN_IN_PROGRESS: {
    label: 'В процессе возврата',
    shortLabel: 'В процессе возврата',
    color: '#9d174d',
    bgColor: '#f9a8d4',
    borderColor: '#f472b6',
    icon: 'down',
    category: 'return',
  },
  // RETURN statuses
  RETURN_NEW: {
    label: 'Новый возврат',
    shortLabel: 'Новый возврат',
    color: '#9d174d',
    bgColor: '#fce7f3',
    borderColor: '#f9a8d4',
    icon: 'down',
    category: 'return',
  },
  RETURN_SHIPPED: {
    label: 'Возврат отгружен',
    shortLabel: 'Возврат отгружен',
    color: '#9a3412',
    bgColor: '#fed7aa',
    borderColor: '#fdba74',
    icon: 'up',
    category: 'return',
  },
  RETURN_DELIVERED: {
    label: 'Возврат доставлен',
    shortLabel: 'Возврат доставлен',
    color: '#166534',
    bgColor: '#bbf7d0',
    borderColor: '#86efac',
    icon: 'check',
    category: 'return',
  },
  RETURN_CANCELLED: {
    label: 'Возврат отменен',
    shortLabel: 'Возврат отменен',
    color: '#4b5563',
    bgColor: '#e5e7eb',
    borderColor: '#d1d5db',
    icon: 'x',
    category: 'return',
  },
};

// ============================================================
// STATUS O'TISH QOIDALARI (Transition Rules)
// ============================================================

export type StatusAction = {
  type: 'transition' | 'special' | 'info';
  label: string;
  targetStatus?: OrderStatus;
  actionCode?: string;
  description?: string;
  requiresConfirmation?: boolean;
};

/**
 * Har bir status uchun mavjud harakatlar
 */
export const getStatusActions = (currentStatus: OrderStatus, orderType: OrderType): StatusAction[] => {
  if (orderType === 'RETURN') {
    // ВОЗВРАТ С ПОЛКИ uchun
    return getReturnActions(currentStatus);
  }
  
  if (orderType === 'RETURN_BY_ORDER') {
    // ВОЗВРАТ ПО ЗАКАЗУ uchun
    return getReturnByOrderActions(currentStatus);
  }

  // ODDIY ZAKAZ uchun
  return getOrderActions(currentStatus);
};

/**
 * ODDIY ZAKAZ (ORDER) harakatlari
 */
const getOrderActions = (status: OrderStatus): StatusAction[] => {
  switch (status) {
    case 'NEW':
      return [
        {
          type: 'transition',
          label: 'Подтвердить к отгрузке',
          targetStatus: 'CONFIRMED',
          description: 'Zakaz tasdiqlanadi va omborga yuboriladi',
          requiresConfirmation: false,
        },
        {
          type: 'transition',
          label: 'Отменен',
          targetStatus: 'CANCELLED',
          description: 'Zakaz bekor qilinadi',
          requiresConfirmation: true,
        },
      ];

    case 'CONFIRMED':
      return [
        {
          type: 'special',
          label: 'Изменить ожидаемую дату отгрузки',
          actionCode: 'change_ship_date',
          description: 'Kutilayotgan jo\'natish sanasini o\'zgartirish',
        },
        {
          type: 'transition',
          label: 'Отгружен',
          targetStatus: 'SHIPPED',
          description: 'Mahsulotlar ombordan chiqarildi',
          requiresConfirmation: false,
        },
        {
          type: 'transition',
          label: 'Отменен',
          targetStatus: 'CANCELLED',
          description: 'Zakaz bekor qilinadi (tasdiqlangandan keyin)',
          requiresConfirmation: true,
        },
      ];

    case 'SHIPPED':
      return [
        {
          type: 'transition',
          label: 'Доставлен',
          targetStatus: 'DELIVERED',
          description: 'Mahsulotlar klientga yetkazildi',
          requiresConfirmation: false,
        },
      ];

    case 'DELIVERED':
      return [
        {
          type: 'special',
          label: 'Возврат с полки по заказ',
          actionCode: 'create_return_by_order',
          description: 'Ushbu zakaz asosida qaytarish yaratiladi',
        },
        {
          type: 'special',
          label: 'Изменить дату доставки',
          actionCode: 'change_delivery_date',
          description: 'Yetkazib berish sanasini o\'zgartirish',
        },
      ];

    case 'CANCELLED':
      return [
        {
          type: 'transition',
          label: 'Вернуть в Новый',
          targetStatus: 'NEW',
          description: 'Zakaz qayta tiklanadi va "Новый" holatiga o\'tadi',
          requiresConfirmation: true,
        },
      ];

    case 'RETURN_IN_PROGRESS':
      return [
        {
          type: 'transition',
          label: 'Подтвердить возврат',
          targetStatus: 'DELIVERED',
          description: 'Qaytarish tasdiqlandi - mahsulotlar omborga qabul qilindi',
          requiresConfirmation: true,
        },
        {
          type: 'transition',
          label: 'Отменить возврат',
          targetStatus: 'CANCELLED',
          description: 'Qaytarish bekor qilindi',
          requiresConfirmation: true,
        },
      ];

    default:
      return [];
  }
};

/**
 * ВОЗВРАТ С ПОЛКИ (RETURN) harakatlari
 */
const getReturnActions = (status: OrderStatus): StatusAction[] => {
  switch (status) {
    case 'RETURN_NEW':
      return [
        {
          type: 'transition',
          label: 'Подтвердить возврат',
          targetStatus: 'RETURN_SHIPPED',
          description: 'Qaytarish tasdiqlandi - omborga yuborilmoqda',
          requiresConfirmation: false,
        },
        {
          type: 'transition',
          label: 'Отменить возврат',
          targetStatus: 'RETURN_CANCELLED',
          description: 'Qaytarish bekor qilindi',
          requiresConfirmation: true,
        },
      ];

    case 'RETURN_SHIPPED':
      return [
        {
          type: 'transition',
          label: 'Доставлен (возврат принят)',
          targetStatus: 'RETURN_DELIVERED',
          description: 'Qaytarilgan mahsulotlar omborga qabul qilindi',
          requiresConfirmation: false,
        },
      ];

    case 'RETURN_DELIVERED':
      return [
        {
          type: 'info',
          label: 'Возврат завершен',
          description: 'Qaytarish jarayoni tugallandi',
        },
      ];

    case 'RETURN_CANCELLED':
      return [
        {
          type: 'transition',
          label: 'Вернуть в Новый возврат',
          targetStatus: 'RETURN_NEW',
          description: 'Qaytarish qayta tiklanadi va "Новый возврат" holatiga o\'tadi',
          requiresConfirmation: true,
        },
      ];

    default:
      return [];
  }
};

/**
 * ВОЗВРАТ ПО ЗАКАЗУ (RETURN_BY_ORDER) harakatlari
 */
const getReturnByOrderActions = (status: OrderStatus): StatusAction[] => {
  // RETURN_BY_ORDER aslida ORDER tipidagi zakazning DELIVERED holatidan boshlanadi
  // Va RETURN_IN_PROGRESS statusiga o'tadi
  switch (status) {
    case 'RETURN_IN_PROGRESS':
      return [
        {
          type: 'transition',
          label: 'Подтвердить возврат',
          targetStatus: 'RETURN_DELIVERED',
          description: 'Qaytarish tasdiqlandi - mahsulotlar omborga qabul qilindi',
          requiresConfirmation: true,
        },
        {
          type: 'transition',
          label: 'Отменить возврат',
          targetStatus: 'RETURN_CANCELLED',
          description: 'Qaytarish bekor qilindi - zakaz holati tiklanadi',
          requiresConfirmation: true,
        },
      ];

    case 'RETURN_DELIVERED':
      return [
        {
          type: 'info',
          label: 'Возврат завершен',
          description: 'Qaytarish jarayoni tugallandi',
        },
      ];

    case 'RETURN_CANCELLED':
      return [
        {
          type: 'info',
          label: 'Возврат отменен',
          description: 'Qaytarish bekor qilindi',
        },
      ];

    default:
      return getOrderActions(status);
  }
};

// ============================================================
// BIZNES LOGIKASI (Business Logic)
// ============================================================

/**
 * Status o'zgartirish mumkinligini tekshirish
 */
export const canChangeStatus = (currentStatus: OrderStatus, orderType: OrderType): boolean => {
  // CANCELLED va RETURN_CANCELLED dan qaytarish mumkin (NEW ga)
  const terminalStatuses: OrderStatus[] = ['RETURN_DELIVERED'];
  if (terminalStatuses.includes(currentStatus)) return false;
  
  const actions = getStatusActions(currentStatus, orderType);
  return actions.some(a => a.type === 'transition');
};

/**
 * Zakaz tahrirlash mumkinligini tekshirish
 */
export const canEditOrder = (status: OrderStatus): boolean => {
  return status === 'NEW';
};

/**
 * Zakaz o'chirish mumkinligini tekshirish
 */
export const canDeleteOrder = (status: OrderStatus): boolean => {
  return status === 'NEW';
};

/**
 * Zakaz qaytarish mumkinligini tekshirish
 */
export const canCreateReturn = (status: OrderStatus, orderType: OrderType): boolean => {
  return orderType === 'ORDER' && status === 'DELIVERED';
};

/**
 * Status ketma-ketligini olish (timeline uchun)
 */
export const getStatusTimeline = (orderType: OrderType): OrderStatus[] => {
  if (orderType === 'RETURN') {
    return ['RETURN_NEW', 'RETURN_SHIPPED', 'RETURN_DELIVERED'];
  }
  return ['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
};

/**
 * Status o'zgarish izohi
 */
export const getStatusChangeDescription = (
  from: OrderStatus,
  to: OrderStatus
): string => {
  const descriptions: Record<string, string> = {
    'NEW→CONFIRMED': 'Zakaz tasdiqlandi va omborga yuborildi',
    'NEW→CANCELLED': 'Zakaz bekor qilindi',
    'CONFIRMED→SHIPPED': 'Mahsulotlar ombordan chiqarildi',
    'CONFIRMED→CANCELLED': 'Tasdiqlangan zakaz bekor qilindi',
    'SHIPPED→DELIVERED': 'Mahsulotlar klientga yetkazildi',
    'DELIVERED→RETURN_IN_PROGRESS': 'Qaytarish jarayoni boshlandi',
    'RETURN_IN_PROGRESS→DELIVERED': 'Qaytarish tasdiqlandi - mahsulotlar qabul qilindi',
    'RETURN_IN_PROGRESS→CANCELLED': 'Qaytarish bekor qilindi',
    'RETURN_NEW→RETURN_SHIPPED': 'Qaytarish tasdiqlandi - omborga yuborilmoqda',
    'RETURN_NEW→RETURN_CANCELLED': 'Qaytarish bekor qilindi',
    'RETURN_SHIPPED→RETURN_DELIVERED': 'Qaytarilgan mahsulotlar omborga qabul qilindi',
  };
  return descriptions[`${from}→${to}`] || `Status o'zgartirildi: ${from} → ${to}`;
};

/**
 * Zakaz turi bo'yicha ruxsat etilgan harakatlar ro'yxati
 */
export const getAllowedActionsByType = (orderType: OrderType): string[] => {
  switch (orderType) {
    case 'ORDER':
      return [
        'create', 'edit', 'delete', 'confirm', 'ship', 'deliver',
        'cancel', 'create_return_by_order', 'change_ship_date', 'change_delivery_date',
      ];
    case 'RETURN':
      return [
        'create', 'confirm_return', 'deliver_return', 'cancel_return',
      ];
    case 'RETURN_BY_ORDER':
      return [
        'confirm_return', 'cancel_return',
      ];
    default:
      return [];
  }
};
