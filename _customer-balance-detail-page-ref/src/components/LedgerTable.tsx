import { ArrowDown, ArrowUp, Inbox, AlertTriangle } from 'lucide-react';
import type { DebtTransaction, SortDir, SortField, ViewTab } from '../types';
import { fmtDateTime, fmtMoney } from '../utils/format';
import { cn } from '../utils/cn';

export interface ColumnDef {
  key: string;
  label: string;
  visible: boolean;
  sortField?: SortField;
  align?: 'right';
  width?: string;
  tabs: ViewTab[];
}

export const allColumns: ColumnDef[] = [
  { key: 'date', label: 'Дата', visible: true, sortField: 'createdAt', width: 'w-[130px]', tabs: ['overall', 'detailed'] },
  { key: 'type', label: 'Тип', visible: true, sortField: 'docNumber', width: 'w-[130px]', tabs: ['overall', 'detailed'] },
  { key: 'opName', label: 'Название типа операции', visible: true, width: 'w-[170px]', tabs: ['detailed'] },
  { key: 'orderType', label: 'Тип заказа', visible: true, width: 'w-[90px]', tabs: ['detailed'] },
  { key: 'consignment_d', label: 'Консигнация', visible: true, width: 'w-[100px]', tabs: ['detailed'] },
  { key: 'debt', label: 'Долг', visible: true, sortField: 'debt', align: 'right', width: 'w-[110px]', tabs: ['overall', 'detailed'] },
  { key: 'payment', label: 'Оплата', visible: true, sortField: 'payment', align: 'right', width: 'w-[90px]', tabs: ['overall', 'detailed'] },
  { key: 'balanceAfter', label: 'Баланс (после)', visible: true, align: 'right', width: 'w-[130px]', tabs: ['detailed'] },
  { key: 'method', label: 'Способ оплаты', visible: true, width: 'w-[130px]', tabs: ['overall', 'detailed'] },
  { key: 'agent', label: 'Агент', visible: true, width: 'w-[200px]', tabs: ['overall', 'detailed'] },
  { key: 'expeditor', label: 'Экспедиторы', visible: true, width: 'w-[120px]', tabs: ['overall', 'detailed'] },
  { key: 'consignment', label: 'Консигнация', visible: true, width: 'w-[100px]', tabs: ['overall'] },
  { key: 'cashbox', label: 'Касса', visible: true, width: 'w-[110px]', tabs: ['overall'] },
  { key: 'comment', label: 'Комментарий', visible: true, width: 'min-w-[240px]', tabs: ['overall', 'detailed'] },
  { key: 'txComment', label: 'Комментарий к транзакциям', visible: true, width: 'min-w-[200px]', tabs: ['detailed'] },
  { key: 'createdBy', label: 'Кто создал', visible: true, width: 'w-[130px]', tabs: ['overall', 'detailed'] },
];

const methodBadge: Record<string, string> = {
  cash: 'bg-green-50 text-green-700 border-green-200',
  transfer: 'bg-blue-50 text-blue-700 border-blue-200',
  terminal: 'bg-purple-50 text-purple-700 border-purple-200',
  mixed: 'bg-amber-50 text-amber-700 border-amber-200',
};

const methodLabel: Record<string, string> = {
  cash: 'Наличные', transfer: 'Перечисление', terminal: 'Terminal', mixed: 'Смешанный',
};

interface Props {
  tab: ViewTab;
  rows: DebtTransaction[];
  loading: boolean;
  error: string | null;
  columns: ColumnDef[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  onRowClick: (t: DebtTransaction) => void;
  onRetry: () => void;
  perPage: number;
}

export default function LedgerTable(p: Props) {
  const cols = p.columns.filter((c) => c.visible && c.tabs.includes(p.tab));

  return (
    <div className="overflow-x-auto border-t border-gray-200">
      <table className="w-full text-[13px] border-collapse min-w-[1100px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 text-gray-500">
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => c.sortField && p.onSort(c.sortField)}
                className={cn(
                  'h-11 px-3 font-medium text-left border-b border-r border-gray-200 last:border-r-0 whitespace-nowrap select-none',
                  c.width,
                  c.align === 'right' && 'text-right',
                  c.sortField && 'cursor-pointer hover:bg-gray-100'
                )}
              >
                <span className={cn('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                  {c.label}
                  {c.sortField === p.sortField && (
                    p.sortDir === 'desc' ? <ArrowDown size={12} className="text-[#1aa096]" /> : <ArrowUp size={12} className="text-[#1aa096]" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {p.loading && Array.from({ length: p.perPage }).map((_, i) => (
            <tr key={i} className="border-b border-gray-100">
              {cols.map((c) => (
                <td key={c.key} className="h-12 px-3 border-r border-gray-100 last:border-r-0">
                  <div className="h-3.5 bg-gray-100 rounded animate-pulse" style={{ width: `${45 + ((i * 17 + c.key.length * 13) % 45)}%` }} />
                </td>
              ))}
            </tr>
          ))}

          {!p.loading && p.error && (
            <tr>
              <td colSpan={cols.length} className="py-16 text-center">
                <AlertTriangle size={32} className="mx-auto text-amber-500 mb-3" />
                <div className="text-gray-700 font-medium mb-1">Ошибка загрузки данных</div>
                <div className="text-gray-400 text-[12px] mb-4">{p.error}</div>
                <button onClick={p.onRetry} className="h-9 px-4 rounded-lg bg-[#1aa096] text-white text-[13px] hover:bg-[#158a81]">
                  Повторить запрос
                </button>
              </td>
            </tr>
          )}

          {!p.loading && !p.error && p.rows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="py-16 text-center">
                <Inbox size={32} className="mx-auto text-gray-300 mb-3" />
                <div className="text-gray-500 font-medium">Записи не найдены</div>
                <div className="text-gray-400 text-[12px] mt-1">Измените параметры фильтра или поиска</div>
              </td>
            </tr>
          )}

          {!p.loading && !p.error && p.rows.map((t) => (
            <tr
              key={t.id}
              onClick={() => p.onRowClick(t)}
              className="border-b border-gray-100 hover:bg-teal-50/40 cursor-pointer transition-colors"
            >
              {cols.map((c) => {
                const base = 'h-12 px-3 border-r border-gray-100 last:border-r-0 whitespace-nowrap';
                switch (c.key) {
                  case 'date':
                    return <td key={c.key} className={cn(base, 'text-gray-600 tabular')}>{fmtDateTime(t.createdAt)}</td>;
                  case 'type':
                    return (
                      <td key={c.key} className={base}>
                        <span className="text-[#1a7ac0] hover:underline">{t.typeLabel} ({t.docNumber})</span>
                      </td>
                    );
                  case 'opName':
                    return <td key={c.key} className={cn(base, 'text-gray-600')}>{t.operationName}</td>;
                  case 'orderType':
                    return <td key={c.key} className={cn(base, 'text-gray-600')}>{t.orderType}</td>;
                  case 'debt':
                    return (
                      <td key={c.key} className={cn(base, 'text-right tabular font-medium', t.debt < 0 ? 'text-red-600' : t.debt > 0 ? 'text-green-600' : 'text-gray-500')}>
                        {fmtMoney(t.debt)}
                      </td>
                    );
                  case 'payment':
                    return (
                      <td key={c.key} className={cn(base, 'text-right tabular font-medium', t.payment > 0 ? 'text-green-600' : 'text-gray-500')}>
                        {fmtMoney(t.payment)}
                      </td>
                    );
                  case 'balanceAfter':
                    return (
                      <td key={c.key} className={cn(base, 'text-right tabular', t.balanceAfter < 0 ? 'text-red-600' : 'text-green-700')}>
                        {fmtMoney(t.balanceAfter)}
                      </td>
                    );
                  case 'method':
                    return (
                      <td key={c.key} className={base}>
                        {t.paymentMethod && (
                          <span className={cn('inline-flex items-center h-6 px-2 rounded border text-[11px] font-medium', methodBadge[t.paymentMethod])}>
                            {p.tab === 'detailed' ? t.paymentMethod : methodLabel[t.paymentMethod]}
                          </span>
                        )}
                      </td>
                    );
                  case 'agent':
                    return <td key={c.key} className={cn(base, 'text-gray-700')}>{t.agent}</td>;
                  case 'expeditor':
                    return <td key={c.key} className={cn(base, 'text-gray-600')}>{t.expeditor}</td>;
                  case 'consignment':
                  case 'consignment_d':
                    return (
                      <td key={c.key} className={base}>
                        <span className={cn(
                          'inline-flex items-center h-6 px-2 rounded text-[11px] font-medium',
                          t.consignment ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-gray-500'
                        )}>
                          {t.consignment ? 'Да' : 'Нет'}
                        </span>
                      </td>
                    );
                  case 'cashbox':
                    return <td key={c.key} className={cn(base, 'text-gray-600')}>{t.cashbox}</td>;
                  case 'comment':
                    return (
                      <td key={c.key} className={cn(base, 'text-gray-600 max-w-[320px] truncate')} title={t.comment}>
                        {p.tab === 'detailed' ? t.txComment : t.comment}
                      </td>
                    );
                  case 'txComment':
                    return (
                      <td key={c.key} className={cn(base, 'text-gray-600 max-w-[280px] truncate')} title={t.comment}>
                        {t.comment}
                      </td>
                    );
                  case 'createdBy':
                    return <td key={c.key} className={cn(base, 'text-gray-700')}>{t.createdBy}</td>;
                  default:
                    return <td key={c.key} className={base} />;
                }
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
