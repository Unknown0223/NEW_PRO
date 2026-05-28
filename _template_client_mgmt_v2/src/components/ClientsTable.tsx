import { useState, useRef, useEffect } from 'react';
import { Edit2, MoreVertical, MapPin } from 'lucide-react';
import { MOCK_CLIENTS } from '../data/mockClients';
import { useClientStore } from '../store/useClientStore';
import { cn } from '../lib/utils';

/* ─── Popup (fixed positioning to escape overflow) ─────────── */
interface PopupProps {
  items: string[];
  trigger: React.ReactNode;
  title: string;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

const Popup = ({ items, trigger, title, anchorRef }: PopupProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const getStyle = (): React.CSSProperties => {
    if (!anchorRef.current || !open) return {};
    const rect = anchorRef.current.getBoundingClientRect();
    return {
      position: 'fixed' as const,
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
      zIndex: 9999,
    };
  };

  return (
    <div ref={ref} className="inline-block">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className="bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden"
          style={{ ...getStyle(), minWidth: 220 }}
        >
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
            {items.map((item, i) => (
              <div
                key={i}
                className="px-3 py-2 text-xs text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 border-b border-gray-50 last:border-0 transition-colors cursor-default"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Days Cell (Side-by-side) ──────────────────────────────── */
const DaysCell = ({ days }: { days: string[] }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const show = days.slice(0, 2);
  const rest = days.slice(2);

  return (
    <div className="flex items-center gap-1 whitespace-nowrap" ref={anchorRef}>
      {show.map(day => (
        <span key={day} className="text-[10px] font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
          {day}
        </span>
      ))}
      {rest.length > 0 && (
        <Popup
          items={days}
          title="Дни"
          anchorRef={anchorRef}
          trigger={
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer hover:bg-emerald-100 font-medium transition-colors">
              ещё {rest.length}
            </span>
          }
        />
      )}
    </div>
  );
};

/* ─── Agents Cell (Side-by-side) ────────────────────────────── */
const AgentsCell = ({ agents }: { agents: string[] }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const first = agents[0];
  const rest = agents.slice(1);

  return (
    <div className="flex items-center gap-1 min-w-[220px]" ref={anchorRef}>
      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md leading-tight block truncate border border-emerald-100 flex-1">
        {first}
      </span>
      {rest.length > 0 && (
        <Popup
          items={agents}
          title="ВСЕ АГЕНТЫ"
          anchorRef={anchorRef}
          trigger={
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer hover:bg-emerald-100 font-medium transition-colors whitespace-nowrap shrink-0">
              ещё {rest.length}
            </span>
          }
        />
      )}
    </div>
  );
};

/* ─── Expeditors Cell (Side-by-side) ────────────────────────── */
const ExpedCell = ({ expeditors }: { expeditors: string[] }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const filtered = expeditors.filter(e => !e.startsWith('ещё'));
  const moreRaw = expeditors.find(e => e.startsWith('ещё'));
  const moreCount = moreRaw ? parseInt(moreRaw.replace('ещё ', '')) : 0;

  const allItems = [...filtered];
  for (let i = 0; i < moreCount; i++) allItems.push(`Экспедитор ${i + filtered.length + 1}`);

  const show = filtered.slice(0, 1);
  const hasMore = filtered.length > 1 || moreCount > 0;

  return (
    <div className="flex items-center gap-1 min-w-[150px]" ref={anchorRef}>
      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-1 rounded border border-emerald-100 truncate flex-1">
        {show[0]}
      </span>
      {hasMore && (
        <Popup
          items={allItems}
          title="Экспедиторы"
          anchorRef={anchorRef}
          trigger={
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer hover:bg-emerald-100 font-medium transition-colors shrink-0">
              ещё {filtered.length - 1 + moreCount}
            </span>
          }
        />
      )}
    </div>
  );
};

/* ─── Main Table ────────────────────────────────────────────── */
export const ClientsTable = () => {
  const { selectedRows, setSelectedRows } = useClientStore();

  const toggleRow = (id: string) => {
    setSelectedRows(
      selectedRows.includes(id)
        ? selectedRows.filter(r => r !== id)
        : [...selectedRows, id]
    );
  };

  const toggleAll = () => {
    setSelectedRows(
      selectedRows.length === MOCK_CLIENTS.length ? [] : MOCK_CLIENTS.map(c => c.id)
    );
  };

  const thCls = "px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap tracking-wide bg-gray-50 border-b border-gray-200";

  return (
    <div className="bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ minWidth: 2200 }}>
          <thead>
            <tr>
              <th className={cn(thCls, "w-10 text-center")}>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  checked={selectedRows.length === MOCK_CLIENTS.length && MOCK_CLIENTS.length > 0}
                  onChange={toggleAll}
                />
              </th>
              <th className={thCls}>Телефон</th>
              <th className={cn(thCls, "min-w-[260px]")}>Агент</th>
              <th className={thCls}>Формат клиента</th>
              <th className={thCls}>День</th>
              <th className={thCls}>Область</th>
              <th className={thCls}>Город</th>
              <th className={thCls}>Зона</th>
              <th className={thCls}>Адрес</th>
              <th className={thCls}>Категория</th>
              <th className={thCls}>Ориентир</th>
              <th className={thCls}>Активный</th>
              <th className={thCls}>Локация</th>
              <th className={thCls}>Код</th>
              <th className={thCls}>Кол-во</th>
              <th className={thCls}>Кол-во закупа</th>
              <th className={thCls}>Экспедиторы</th>
              <th className={thCls}>ИНН</th>
              <th className={thCls}>Контактное лицо</th>
              <th className={thCls}>Тип цены</th>
              <th className={thCls}>Баланс</th>
              <th className={thCls}>Разрешить консигнацию</th>
              <th className={thCls}>Заказ при наличии долga</th>
              <th className={thCls}>Штрих код</th>
              <th className={thCls}>МФО</th>
              <th className={thCls}>Комментарий</th>
              <th className={thCls}>ТипТТ</th>
              <th className={thCls}>Канал продаж</th>
              <th className={thCls}>Договор №</th>
              <th className={thCls}>ПИНФЛ</th>
              <th className={thCls}>Дата создания</th>
              <th className={thCls}>Кто создал</th>
              <th className={cn(thCls, "w-10 text-center")}>
                <MoreVertical className="w-3.5 h-3.5 text-gray-400 mx-auto" />
              </th>
            </tr>
          </thead>

          <tbody>
            {MOCK_CLIENTS.map((client, idx) => (
              <tr
                key={client.id}
                className={cn(
                  "group border-b border-gray-100 hover:bg-emerald-50/30 transition-colors",
                  selectedRows.includes(client.id) && "bg-emerald-50/50",
                  idx % 2 === 1 && "bg-gray-50/40"
                )}
              >
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    checked={selectedRows.includes(client.id)}
                    onChange={() => toggleRow(client.id)}
                  />
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs text-gray-600 whitespace-nowrap">{client.phone}</span>
                </td>
                <td className="px-3 py-3">
                  <AgentsCell agents={client.agents} />
                </td>
                <td className="px-3 py-3">
                  <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                    {client.format}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <DaysCell days={client.days} />
                </td>
                <td className="px-3 py-3 text-[10px] text-gray-600 uppercase whitespace-nowrap">{client.region}</td>
                <td className="px-3 py-3 text-[10px] text-gray-600 uppercase whitespace-nowrap">{client.city}</td>
                <td className="px-3 py-3 text-[10px] text-gray-600">{client.zone}</td>
                <td className="px-3 py-3 text-[10px] text-gray-600 truncate max-w-[120px]">{client.address}</td>
                <td className="px-3 py-3 text-center">
                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 w-6 h-6 flex items-center justify-center rounded-full border border-gray-200 inline-flex">
                    {client.category}
                  </span>
                </td>
                <td className="px-3 py-3 text-[10px] text-gray-600 block max-w-[130px] leading-tight">{client.landmark}</td>
                <td className="px-3 py-3">
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-1 rounded-md border",
                    client.active
                      ? "text-emerald-700 bg-emerald-100 border-emerald-200"
                      : "text-gray-500 bg-gray-100 border-gray-200"
                  )}>
                    {client.active ? 'Активный' : 'Не активный'}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {client.location && (
                    <MapPin className="w-4 h-4 text-emerald-500 mx-auto cursor-pointer hover:text-emerald-700" />
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-700">{client.code}</td>
                <td className="px-3 py-3 text-xs text-gray-700">{client.qtyOrders}</td>
                <td className="px-3 py-3 text-xs text-gray-700">{client.qtyPurchase}</td>
                <td className="px-3 py-3"><ExpedCell expeditors={client.expeditors} /></td>
                <td className="px-3 py-3 text-xs text-gray-700">{client.inn}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.contactPerson}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.priceType}</td>
                <td className="px-3 py-3 font-medium text-xs">{(client.balance ?? 0).toLocaleString()}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.allowConsignment}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.allowDebt}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.barcode}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.mfo}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.comment}</td>
                <td className="px-3 py-3"><span className="text-[10px] text-gray-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{client.typeTT}</span></td>
                <td className="px-3 py-3"><span className="text-[10px] text-gray-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{client.salesChannel}</span></td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.contractNo}</td>
                <td className="px-3 py-3 text-xs text-gray-600">{client.pinfl}</td>
                <td className="px-3 py-3 text-[10px] text-gray-500 whitespace-nowrap">{client.createdAt}</td>
                <td className="px-3 py-3 text-[10px] text-emerald-600 whitespace-nowrap">{client.createdBy}</td>
                <td className="px-3 py-3 text-center">
                  <button className="p-1 hover:bg-amber-50 rounded text-amber-400 hover:text-amber-600 transition-colors opacity-0 group-hover:opacity-100">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
