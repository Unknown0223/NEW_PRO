import { useState, useMemo, useCallback } from 'react';
import type { Order, PaymentStatistics, Filters } from '../types';
import { mockOrders } from '../data/mockOrders';
import { parseNumber } from '../utils/format';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filters, setFilters] = useState<Filters>({
    date: '2026-05-25T16:57',
    kassa: 'Касса',
    errorOnly: false,
  });

  const filteredOrders = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'Доставлен');
    if (!filters.errorOnly) return deliveredOrders;
    return deliveredOrders.filter((o) => o.hasError);
  }, [orders, filters.errorOnly]);

  const statistics: PaymentStatistics = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'Доставлен');
    const cash = deliveredOrders.reduce((s, o) => s + (o.cash || 0), 0);
    const oldDebtIncome = deliveredOrders.reduce((s, o) => s + (o.oldDebtIncome || 0), 0);
    const terminal = deliveredOrders.reduce((s, o) => s + (o.terminal || 0), 0);
    const tengeCash = deliveredOrders.reduce((s, o) => s + (o.tengeCash || 0), 0);
    const bankTransfer = deliveredOrders.reduce((s, o) => s + (o.bankTransfer || 0), 0);
    const rial = deliveredOrders.reduce((s, o) => s + (o.rial || 0), 0);
    const received = cash + oldDebtIncome + terminal + tengeCash + bankTransfer + rial;
    const total = deliveredOrders.reduce((s, o) => s + (o.orderAmount || 0), 0);
    const totalDebt = deliveredOrders.reduce((s, o) => s + (o.debt || 0), 0);

    const unpaidPerOrder = deliveredOrders.map((o) => {
      const paid =
        (o.cash || 0) +
        (o.oldDebtIncome || 0) +
        (o.terminal || 0) +
        (o.tengeCash || 0) +
        (o.bankTransfer || 0) +
        (o.rial || 0);
      return Math.max(0, o.orderAmount - paid);
    });
    const unpaid = unpaidPerOrder.reduce((s, x) => s + x, 0);

    return {
      total,
      received,
      totalDebt,
      remaining: Math.max(0, total - received),
      cash,
      oldDebtIncome,
      terminal,
      tengeCash,
      bankTransfer,
      rial,
      unpaid,
    };
  }, [orders]);

  const onUpdateOrder = useCallback((id: number, field: keyof Order, value: any) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const updated = { ...o, [field]: value } as Order;
        const paid =
          (updated.cash || 0) +
          (updated.oldDebtIncome || 0) +
          (updated.terminal || 0) +
          (updated.tengeCash || 0) +
          (updated.bankTransfer || 0) +
          (updated.rial || 0);
        updated.unpaid = Math.max(0, updated.orderAmount - paid);
        return updated;
      })
    );
  }, []);

  const onSuccessCount = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'Доставлен');
    return deliveredOrders.filter((o) => o.unpaid === 0).length;
  }, [orders]);

  void parseNumber;

  return {
    orders: filteredOrders,
    filters,
    statistics,
    onSuccessCount,
    onUpdateOrder,
    setFilters,
  };
}
