import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, RotateCcw, Check } from 'lucide-react';
import { cn } from '../lib/utils';

/* ─── Types ──────────────────────────────────────────────── */
interface Option { value: string; label: string; }

interface SelectFieldProps {
  label: string;
  options: Option[];
  values: string[];          // multi-select array
  onChange: (v: string[]) => void;
  multi?: boolean;
}

/* ─── SelectField ────────────────────────────────────────── */
const SelectField = ({ label, options, values, onChange, multi = false }: SelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasValue = values.length > 0;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (val: string) => {
    if (multi) {
      onChange(values.includes(val) ? values.filter(v => v !== val) : [...values, val]);
    } else {
      onChange(values.includes(val) ? [] : [val]);
      setOpen(false);
    }
  };

  const toggleAll = () => {
    if (values.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(o => o.value));
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Display text
  const displayText = multi
    ? values.length === 0
      ? ''
      : `${options.find(o => o.value === values[0])?.label}${values.length > 1 ? ` (+${values.length - 1})` : ''}`
    : (options.find(o => o.value === values[0])?.label || '');

  return (
    <div ref={ref} className="relative w-full">
      {/* ─ Trigger ─ */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-full h-[38px] text-left border rounded-lg bg-white transition-colors focus:outline-none px-3',
          'flex items-center justify-between gap-1',
          open
            ? 'border-emerald-400 ring-1 ring-emerald-200'
            : 'border-gray-200 hover:border-gray-300'
        )}
      >
        {/* ── Floating label ── */}
        <span
          className={cn(
            'absolute transition-all duration-200 pointer-events-none bg-white leading-none',
            hasValue
              ? 'top-0 -translate-y-1/2 text-[10px] text-gray-400 left-2 px-1'
              : 'top-1/2 -translate-y-1/2 text-[13px] text-gray-400 left-3'
          )}
        >
          {label}
        </span>

        {/* ── Value ── */}
        {displayText ? (
          <span className="text-[13px] text-gray-800 truncate flex-1 min-w-0 pt-0.5 ml-1">
            {displayText}
          </span>
        ) : (
          <span className="flex-1" />
        )}

        {/* ── Right icons ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          {hasValue && (
            <span
              onClick={clearAll}
              className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-100 cursor-pointer"
            >
              <X className="w-3 h-3 text-gray-400" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-gray-400 transition-transform duration-150',
              open && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* ─ Dropdown ─ */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[180px]">
          {/* "Выбрать все" */}
          {multi && (
            <button
              type="button"
              onClick={toggleAll}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-600 hover:bg-gray-50 border-b border-gray-100 transition-colors"
            >
              <span className={cn(
                'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                values.length === options.length
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-gray-300'
              )}>
                {values.length === options.length && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className="font-medium">Выбрать все</span>
            </button>
          )}
          {/* Options */}
          <div className="max-h-48 overflow-y-auto py-1">
            {options.map(opt => {
              const checked = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors',
                    checked && 'bg-emerald-50/50'
                  )}
                >
                  {/* Checkbox */}
                  {multi ? (
                    <span className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                    )}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </span>
                  ) : (
                    <span className={cn(
                      'w-4 h-4 rounded-full border flex items-center justify-center shrink-0',
                      checked ? 'border-emerald-500' : 'border-gray-300'
                    )}>
                      {checked && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </span>
                  )}
                  <span className={cn('truncate', checked && 'text-emerald-700 font-medium')}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Filter definitions ─────────────────────────────────── */
interface FilterCfg { id: string; label: string; options: Option[]; multi?: boolean; }

const FILTERS: FilterCfg[] = [
  {
    id: 'agent', label: 'Агент', multi: true,
    options: [
      { value: 'a1', label: 'JSFA S 003 [XALMATOVA OYDIN]' },
      { value: 'a2', label: 'FALLK (U) TP-03 [GULOMOV]' },
      { value: 'a3', label: 'ECARFA [ABDUSATTOROV]' },
      { value: 'a4', label: 'MONNOFA01 - [ABDULKAYEV]' },
    ],
  },
  {
    id: 'clientType', label: 'Тип клиента',
    options: [
      { value: '777', label: '777' },
      { value: 'Superettes', label: 'Superettes' },
      { value: 'Perfumery', label: 'Perfumery' },
      { value: 'Supermarket', label: 'Supermarket' },
    ],
  },
  {
    id: 'category', label: 'Категория клиента',
    options: [
      { value: 'A', label: 'A' }, { value: 'B', label: 'B' },
      { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
    ],
  },
  {
    id: 'format', label: 'Формат клиента',
    options: [
      { value: 'Drogery', label: 'Drogery' },
      { value: 'Superettes', label: 'Superettes' },
      { value: 'Perfumery', label: 'Perfumery' },
    ],
  },
  {
    id: 'supervisor', label: 'Супервайзер', multi: true,
    options: [
      { value: 's1', label: 'Ergashojayev Bekzod' },
      { value: 's2', label: 'Botirov Anvar' },
    ],
  },
  {
    id: 'channel', label: 'Канал продаж',
    options: [
      { value: 'HORECA', label: 'HORECA' },
      { value: 'TRAD_TRADE', label: 'TRAD TRADE' },
      { value: 'KEY_ACCOUNT', label: 'KEY ACCOUNT' },
    ],
  },
  {
    id: 'day', label: 'День', multi: true,
    options: [
      { value: 'Пн', label: 'Пн' }, { value: 'Вт', label: 'Вт' },
      { value: 'Ср', label: 'Ср' }, { value: 'Чт', label: 'Чт' },
      { value: 'Пт', label: 'Пт' }, { value: 'Сб', label: 'Сб' },
    ],
  },
  {
    id: 'expeditor', label: 'Экспедиторы', multi: true,
    options: [
      { value: 'e1', label: '01-BLOK SIROJIDDIN' },
      { value: 'e2', label: 'TILAVOLDIYEV RAHMIDDIN' },
    ],
  },
  {
    id: 'status', label: 'Статус',
    options: [
      { value: 'active', label: 'Активный' },
      { value: 'inactive', label: 'Не активный' },
    ],
  },
  {
    id: 'location', label: 'Локация',
    options: [
      { value: 'yes', label: 'Есть' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'equipment', label: 'Тип оборудования',
    options: [
      { value: 'eq1', label: 'POLKA [AVTOBUS KA...' },
      { value: 'eq2', label: 'ХОЛОДИЛЬНИК' },
      { value: 'eq3', label: 'ДИСПЛЕЙ' },
    ],
  },
  {
    id: 'inn', label: 'ИНН',
    options: [
      { value: 'no_inn', label: 'Без ИНН' },
      { value: 'has_inn', label: 'С ИНН' },
    ],
  },
  {
    id: 'hasInventory', label: 'Есть инвентарь',
    options: [
      { value: 'all', label: 'Все' },
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'phone', label: 'Телефон',
    options: [
      { value: 'all', label: 'Все' },
      { value: 'yes', label: 'Есть' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'debtOrder', label: 'Можно заказать в долге',
    options: [
      { value: 'all', label: 'Все' },
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'consignStock', label: 'Можно заказать с конси...',
    options: [
      { value: 'all', label: 'Все' },
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'consign', label: 'Можно заказать с конси...',
    options: [
      { value: 'all', label: 'Все' },
      { value: 'yes', label: 'Да' },
      { value: 'no', label: 'Нет' },
    ],
  },
  {
    id: 'zone', label: 'Зона', multi: true,
    options: [
      { value: 'FV', label: 'FV' },
      { value: 'QOZOGISTON', label: 'QOZOG\'ISTON' },
      { value: 'SAUDIYA', label: 'SAUDIYA ARABISTON' },
      { value: 'SOUTH_WEST', label: 'SOUTH-WEST' },
      { value: 'TOSHKENT', label: 'TOSHKENT' },
    ],
  },
  {
    id: 'region', label: 'Область',
    options: [
      { value: 'fargona', label: 'FARGONA VILOYATI' },
      { value: 'toshkent', label: 'TOSHKENT' },
      { value: 'sergeli', label: 'SERGELI FILIAL' },
    ],
  },
  {
    id: 'city', label: 'Город',
    options: [
      { value: 'toshloq', label: 'TOSHLOQ' },
      { value: 'marglon', label: 'MARGLON TRZ' },
      { value: 'yangiYul', label: 'YANGI YUL' },
    ],
  },
];

/* ─── Props ──────────────────────────────────────────────── */
interface ClientsFiltersProps {
  filters: Record<string, string[]>;
  setFilters: (f: Record<string, string[]>) => void;
  resetFilters: () => void;
}

/* ─── Main ───────────────────────────────────────────────── */
export const ClientsFilters = ({ filters, setFilters, resetFilters }: ClientsFiltersProps) => {
  const set = (id: string, val: string[]) => setFilters({ ...filters, [id]: val });
  const byId = (id: string) => filters[id] || [];

  const row1 = FILTERS.slice(0, 7);
  const row2 = FILTERS.slice(7, 14);
  const row3 = FILTERS.slice(14, 20);

  return (
    <div className="bg-white border-b border-gray-100 shadow-sm px-6 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Клиенты</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white gap-1">
            <span className="text-gray-400 text-[10px] mr-1">📅 Дата</span>
            <button className="text-gray-400 hover:text-gray-700">&lt;</button>
            <span className="font-medium text-gray-700 mx-1 whitespace-nowrap">01.01.2023 – 27.05.2026</span>
            <button className="text-gray-400 hover:text-gray-700">&gt;</button>
            <span className="text-gray-200 mx-1">|</span>
            <button className="text-gray-400 hover:text-gray-600">≡</button>
          </div>
          <button className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-sm">
            Добавить клиента
          </button>
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {row1.map(f => (
          <SelectField key={f.id} label={f.label} options={f.options} values={byId(f.id)} onChange={v => set(f.id, v)} multi={f.multi} />
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {row2.map(f => (
          <SelectField key={f.id} label={f.label} options={f.options} values={byId(f.id)} onChange={v => set(f.id, v)} multi={f.multi} />
        ))}
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-7 gap-2 items-center">
        {row3.map(f => (
          <SelectField key={f.id} label={f.label} options={f.options} values={byId(f.id)} onChange={v => set(f.id, v)} multi={f.multi} />
        ))}
        <div className="flex items-center gap-2">
          <button onClick={resetFilters} title="Сбросить" className="h-[38px] w-[38px] flex items-center justify-center border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors shrink-0">
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
          <button className="flex-1 h-[38px] bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shadow-sm">
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};
