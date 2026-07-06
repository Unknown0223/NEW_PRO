import type { DebtTransaction } from '../types';
import { fmtDateTime } from './format';

// Excel-compatible export: CSV with UTF-8 BOM and ; separator (RU locale Excel)
export function exportToExcel(rows: DebtTransaction[], filename: string) {
  const header = [
    'Дата', 'Тип', 'Название операции', 'Тип заказа', 'Долг', 'Оплата', 'Баланс (после)',
    'Способ оплаты', 'Агент', 'Экспедиторы', 'Консигнация', 'Касса', 'Комментарий',
    'Комментарий к транзакциям', 'Кто создал',
  ];

  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = rows.map((t) => [
    fmtDateTime(t.createdAt),
    `${t.typeLabel} (${t.docNumber})`,
    t.operationName,
    t.orderType,
    t.debt,
    t.payment,
    t.balanceAfter,
    t.paymentMethod ?? '',
    t.agent,
    t.expeditor,
    t.consignment ? 'Да' : 'Нет',
    t.cashbox,
    t.comment,
    t.txComment,
    t.createdBy,
  ].map(esc).join(';'));

  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
