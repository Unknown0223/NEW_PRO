import { X, FileSpreadsheet, Download, History, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BalanceCard, DebtTransaction } from '../types';
import { fmtDateTime, fmtMoney, fmtUZS } from '../utils/format';
import { cn } from '../utils/cn';

function Overlay({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('bg-white rounded-lg shadow-2xl w-full max-h-[88vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-xl')}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, icon, onClose }: { title: string; icon?: React.ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
      <div className="flex items-center gap-2.5 text-[16px] font-semibold text-gray-800">{icon}{title}</div>
      <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100">
        <X size={16} />
      </button>
    </div>
  );
}

// ===== MODAL 2: Transaction Details =====

export function TransactionModal({ tx, onClose }: { tx: DebtTransaction; onClose: () => void }) {
  const fields: [string, React.ReactNode][] = [
    ['Документ', `${tx.typeLabel} (${tx.docNumber})`],
    ['Дата создания', fmtDateTime(tx.createdAt)],
    ['Название операции', tx.operationName],
    ['Тип заказа', tx.orderType],
    ['Долг', <span key="d" className={tx.debt < 0 ? 'text-red-600 font-semibold tabular' : 'tabular'}>{fmtUZS(tx.debt)}</span>],
    ['Оплата', <span key="p" className={tx.payment > 0 ? 'text-green-600 font-semibold tabular' : 'tabular'}>{fmtUZS(tx.payment)}</span>],
    ['Баланс (после)', <span key="b" className={cn('tabular font-semibold', tx.balanceAfter < 0 ? 'text-red-600' : 'text-green-700')}>{fmtUZS(tx.balanceAfter)}</span>],
    ['Способ оплаты', tx.paymentMethod ?? '—'],
    ['Агент', tx.agent],
    ['Экспедитор', tx.expeditor || '—'],
    ['Консигнация', tx.consignment ? 'Да' : 'Нет'],
    ['Касса', tx.cashbox || '—'],
    ['Комментарий', tx.comment || '—'],
    ['Комментарий к транзакции', tx.txComment || '—'],
    ['Кто создал', tx.createdBy],
  ];

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title={`Детали транзакции · ${tx.typeLabel} (${tx.docNumber})`} icon={<Receipt size={17} className="text-[#1aa096]" />} onClose={onClose} />
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-lg border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-500 uppercase">Запись главной книги</div>
          <div className="divide-y divide-gray-100">
            {fields.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-4 py-2 text-[13px]">
                <span className="text-gray-500 shrink-0">{k}</span>
                <span className="text-gray-800 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 h-fit">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 text-[12px] font-semibold text-gray-500 uppercase flex items-center gap-2">
            <History size={13} /> Аудит / История
          </div>
          <div className="p-4 space-y-4">
            {tx.audit.map((a, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={cn('w-2.5 h-2.5 rounded-full mt-1', i === 0 ? 'bg-[#1aa096]' : 'bg-gray-300')} />
                  {i < tx.audit.length - 1 && <span className="flex-1 w-px bg-gray-200 mt-1" />}
                </div>
                <div className="pb-1">
                  <div className="text-[13px] text-gray-800">{a.action}</div>
                  <div className="text-[11px] text-gray-400 tabular">{fmtDateTime(a.at)} · {a.user}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button className="flex-1 h-9 rounded-lg border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50">Открыть заказ</button>
            <button className="flex-1 h-9 rounded-lg border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50">Накладная</button>
            <button className="flex-1 h-9 rounded-lg border border-gray-200 text-[12px] text-gray-600 hover:bg-gray-50">Оплата</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ===== MODAL 3: Export dialog =====

export type ExportMode = 'page' | 'filtered' | 'full';

export function ExportModal({ onClose, onExport, exporting, counts }: {
  onClose: () => void;
  onExport: (mode: ExportMode) => void;
  exporting: boolean;
  counts: { page: number; filtered: number; full: number };
}) {
  const [mode, setMode] = useState<ExportMode>('filtered');
  const options: { value: ExportMode; title: string; desc: string; count: number }[] = [
    { value: 'page', title: 'Текущая страница', desc: 'Экспорт только видимых строк', count: counts.page },
    { value: 'filtered', title: 'С учётом фильтров', desc: 'Все записи по текущим фильтрам и поиску', count: counts.filtered },
    { value: 'full', title: 'Полный отчёт', desc: 'Весь леджер клиента без фильтров', count: counts.full },
  ];

  return (
    <Overlay onClose={onClose}>
      <ModalHeader title="Экспорт в Excel" icon={<FileSpreadsheet size={17} className="text-green-600" />} onClose={onClose} />
      <div className="p-5 space-y-2.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors',
              mode === o.value ? 'border-[#1aa096] bg-teal-50/50' : 'border-gray-200 hover:border-gray-300'
            )}
          >
            <input type="radio" checked={mode === o.value} onChange={() => setMode(o.value)} className="accent-[#1aa096]" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-gray-800">{o.title}</div>
              <div className="text-[12px] text-gray-400">{o.desc}</div>
            </div>
            <span className="text-[12px] text-gray-500 bg-gray-100 rounded-full px-2.5 py-1 tabular">{o.count} строк</span>
          </label>
        ))}
        <div className="pt-3 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50">
            Отмена
          </button>
          <button
            onClick={() => onExport(mode)}
            disabled={exporting}
            className="h-10 px-5 rounded-lg bg-[#1aa096] text-white text-[13px] font-medium hover:bg-[#158a81] disabled:opacity-70 flex items-center gap-2"
          >
            <Download size={14} className={exporting ? 'animate-pulse' : ''} />
            {exporting ? 'Экспорт…' : 'Скачать Excel'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ===== MODAL 1: Overall balance breakdown =====

export function OverallBalanceModal({ cards, onClose }: { cards: BalanceCard[]; onClose: () => void }) {
  const total = cards.reduce((s, c) => s + c.amount, 0);
  const channels = [
    { label: 'Наличные (Naqd)', value: cards.reduce((s, c) => s + c.cash, 0), cls: 'text-green-700' },
    { label: 'Перечисление (Pereches)', value: cards.reduce((s, c) => s + c.transfer, 0), cls: 'text-blue-700' },
    { label: 'Терминал', value: cards.reduce((s, c) => s + c.terminal, 0), cls: 'text-purple-700' },
    { label: 'Эски карздан кирим', value: cards.reduce((s, c) => s + c.oldDebtIncome, 0), cls: 'text-gray-700' },
  ];

  return (
    <Overlay onClose={onClose} wide>
      <ModalHeader title="Общий блок · Сводный баланс" onClose={onClose} />
      <div className="p-5 space-y-5">
        <div className="rounded-lg bg-[#113B3B] text-white p-5 flex items-center justify-between">
          <div>
            <div className="text-teal-200/70 text-[12px] mb-1">Итоговый баланс клиента (все агенты)</div>
            <div className={cn('text-[28px] font-bold tabular', total < 0 ? 'text-red-400' : 'text-white')}>{fmtMoney(total)} So'm</div>
          </div>
          <div className="text-right text-[12px] text-teal-200/70">
            Территория: <span className="text-white">SERGELI</span><br />
            Агентов: <span className="text-white">{cards.length - 1}</span>
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-500 uppercase mb-2">Разбивка по агентам</div>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                <span className="text-gray-700">{c.title}</span>
                <span className={cn('tabular font-semibold', c.amount < 0 ? 'text-red-600' : 'text-gray-800')}>{fmtUZS(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] font-semibold text-gray-500 uppercase mb-2">Разбивка по каналам оплаты</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {channels.map((ch) => (
              <div key={ch.label} className="rounded-lg border border-gray-200 p-3">
                <div className="text-[11px] text-gray-400 mb-1">{ch.label}</div>
                <div className={cn('text-[15px] font-bold tabular', ch.value < 0 ? 'text-red-600' : ch.cls)}>{fmtUZS(ch.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}
