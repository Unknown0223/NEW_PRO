import { X } from 'lucide-react';
import type { Filters, PaymentMethod, TransactionType } from '../types';
import { emptyFilters } from '../types';
import { agents, cashboxes, creators, expeditors } from '../data';
import { cn } from '../utils/cn';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
}

const typeOptions: { value: TransactionType; label: string }[] = [
  { value: 'order', label: 'Заказ' },
  { value: 'invoice', label: 'Накладная' },
  { value: 'payment', label: 'Оплата' },
  { value: 'return', label: 'Возврат' },
  { value: 'correction', label: 'Корректировка' },
  { value: 'debt_adjustment', label: 'Корр. долга' },
];

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Наличные' },
  { value: 'terminal', label: 'Терминал' },
  { value: 'transfer', label: 'Перечисление' },
  { value: 'mixed', label: 'Смешанный' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-8 px-3 rounded-md border text-[12px] transition-colors',
        active
          ? 'bg-[#1aa096] border-[#1aa096] text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
      )}
    >
      {children}
    </button>
  );
}

const inputCls = 'w-full h-9 px-3 rounded-md border border-gray-200 text-[13px] focus:outline-none focus:border-[#1aa096] focus:ring-2 focus:ring-teal-100';

export default function FilterPanel({ filters, onChange, onClose }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggle = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50/70 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[13px] font-semibold text-gray-700">Фильтры</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(emptyFilters)}
            className="h-8 px-3 rounded-md text-[12px] text-gray-500 hover:bg-gray-100"
          >
            Сбросить всё
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Field label="Тип транзакции">
          <div className="flex flex-wrap gap-1.5">
            {typeOptions.map((t) => (
              <Chip key={t.value} active={filters.types.includes(t.value)} onClick={() => set({ types: toggle(filters.types, t.value) })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Способ оплаты">
          <div className="flex flex-wrap gap-1.5">
            {methodOptions.map((m) => (
              <Chip key={m.value} active={filters.paymentMethods.includes(m.value)} onClick={() => set({ paymentMethods: toggle(filters.paymentMethods, m.value) })}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Агент (мульти-выбор)">
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a) => (
              <Chip key={a} active={filters.agents.includes(a)} onClick={() => set({ agents: toggle(filters.agents, a) })}>
                {a.split(' ')[0]} {a.includes('TOSH') ? 'TOSH' : 'SET'}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Экспедитор (мульти-выбор)">
          <div className="flex flex-wrap gap-1.5">
            {expeditors.map((e) => (
              <Chip key={e} active={filters.expeditors.includes(e)} onClick={() => set({ expeditors: toggle(filters.expeditors, e) })}>
                {e}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Консигнация">
          <select value={filters.consignment} onChange={(e) => set({ consignment: e.target.value as Filters['consignment'] })} className={inputCls}>
            <option value="">Все</option>
            <option value="yes">Да</option>
            <option value="no">Нет</option>
          </select>
        </Field>

        <Field label="Касса">
          <select value={filters.cashbox} onChange={(e) => set({ cashbox: e.target.value })} className={inputCls}>
            <option value="">Все кассы</option>
            {cashboxes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Комментарий">
          <input value={filters.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Поиск по комментарию" className={inputCls} />
        </Field>

        <Field label="Кто создал">
          <select value={filters.createdBy} onChange={(e) => set({ createdBy: e.target.value })} className={inputCls}>
            <option value="">Все пользователи</option>
            {creators.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Долг (диапазон, UZS)">
          <div className="flex gap-2">
            <input type="number" value={filters.debtMin} onChange={(e) => set({ debtMin: e.target.value })} placeholder="Мин" className={inputCls} />
            <input type="number" value={filters.debtMax} onChange={(e) => set({ debtMax: e.target.value })} placeholder="Макс" className={inputCls} />
          </div>
        </Field>

        <Field label="Оплата (диапазон, UZS)">
          <div className="flex gap-2">
            <input type="number" value={filters.paymentMin} onChange={(e) => set({ paymentMin: e.target.value })} placeholder="Мин" className={inputCls} />
            <input type="number" value={filters.paymentMax} onChange={(e) => set({ paymentMax: e.target.value })} placeholder="Макс" className={inputCls} />
          </div>
        </Field>
      </div>
    </div>
  );
}
