import { useMemo, useState } from 'react';
import {
  CATEGORIES, CLIENTS, AGENTS, WAREHOUSES, DIRECTIONS, DISCOUNTS,
  PRICE_TYPES, generateProducts, formatMoney, type Product,
} from '../../utils/constants';
import {
  IconCalendar, IconChevronLeft, IconChevronRight, IconSearch,
  IconRefresh, IconCube, IconList, IconWallet, IconDoc,
} from '../../components/layout/Icons';

const ALL_PRODUCTS: Product[] = generateProducts();

type RowState = { block: number; qty: number };

export function CreateReturnPage() {
  const [agent, setAgent] = useState(AGENTS[0]);
  const [warehouse, setWarehouse] = useState(WAREHOUSES[0]);
  const [direction, setDirection] = useState(DIRECTIONS[0]);
  const [discount, setDiscount] = useState(DISCOUNTS[0]);
  const [client, setClient] = useState(CLIENTS[0]);
  const [priceType, setPriceType] = useState('naqd_pul');

  const [selectedCats, setSelectedCats] = useState<string[]>([
    'Arzon Lipuchka', 'Bonus', 'Dielux trusik', "DRY (Qo'ltiq qistirma)",
  ]);
  const [activeTab, setActiveTab] = useState<string>('Arzon Lipuchka');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [note, setNote] = useState('');

  const toggleCat = (c: string) => {
    setSelectedCats((prev) => {
      const has = prev.includes(c);
      const next = has ? prev.filter((x) => x !== c) : [...prev, c];
      if (!has) setActiveTab(c);
      else if (activeTab === c && next.length) setActiveTab(next[0]);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCats.length === CATEGORIES.length) setSelectedCats([]);
    else {
      setSelectedCats([...CATEGORIES]);
      setActiveTab(CATEGORIES[0]);
    }
  };

  const tabProducts = useMemo(
    () => ALL_PRODUCTS.filter(
      (p) => p.category === activeTab &&
      (search === '' || p.name.toLowerCase().includes(search.toLowerCase()))
    ),
    [activeTab, search],
  );

  const setBlock = (id: string, v: number, perBlock: number) => {
    setRows((r) => ({ ...r, [id]: { block: v, qty: v * perBlock } }));
  };
  const setQty = (id: string, v: number, perBlock: number) => {
    setRows((r) => ({ ...r, [id]: { block: Math.floor(v / perBlock), qty: v } }));
  };

  // totals across all rows
  const totals = useMemo(() => {
    let volume = 0, qty = 0, sum = 0;
    Object.entries(rows).forEach(([id, st]) => {
      const p = ALL_PRODUCTS.find((x) => x.id === id);
      if (!p) return;
      volume += p.volume * st.qty;
      qty += st.qty;
      sum += p.price * st.qty;
    });
    return { volume, qty, sum };
  }, [rows]);

  const tabTotalQty = tabProducts.reduce(
    (a, p) => a + (rows[p.id]?.qty ?? 0), 0,
  );
  const tabTotalSum = tabProducts.reduce(
    (a, p) => a + p.price * (rows[p.id]?.qty ?? 0), 0,
  );

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-6 flex-wrap">
          <h1 className="text-[20px] font-bold text-slate-800">Создать возврат с полки</h1>

          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5">
              <button className="p-1 text-slate-400 hover:text-slate-600"><IconChevronLeft className="w-4 h-4" /></button>
              <div className="flex items-center gap-2 px-2">
                <IconCalendar className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-[10px] text-slate-400 leading-none">Дата заказа</div>
                  <div className="text-sm font-medium text-slate-700">21 Май 2026 19:16</div>
                </div>
              </div>
              <button className="p-1 text-slate-400 hover:text-slate-600"><IconChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="field min-w-[280px]">
              <label>Клиенты</label>
              <select value={client} onChange={(e) => setClient(e.target.value)}>
                {CLIENTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Three-column main */}
      <div className="grid grid-cols-12 gap-4">
        {/* Order data */}
        <div className="col-span-12 lg:col-span-3 card p-5 space-y-4">
          <h2 className="text-[15px] font-semibold text-slate-800">Данные заказа</h2>
          <div className="field">
            <label>Агент</label>
            <select value={agent} onChange={(e) => setAgent(e.target.value)}>
              {AGENTS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Склад для возврата</label>
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              {WAREHOUSES.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Направление торговли</label>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              {DIRECTIONS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Тип скидки</label>
            <select value={discount} onChange={(e) => setDiscount(e.target.value)}>
              {DISCOUNTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Categories */}
        <div className="col-span-12 lg:col-span-6 card p-5">
          <h2 className="text-[15px] font-semibold text-slate-800 mb-4">Категории товаров</h2>
          <div className="flex flex-wrap gap-2.5">
            <span className="chip" onClick={selectAll}>
              Выбрать все <span className="info">i</span>
            </span>
            {CATEGORIES.map((c) => {
              const active = selectedCats.includes(c);
              return (
                <span
                  key={c}
                  className={`chip ${active ? 'active' : ''}`}
                  onClick={() => toggleCat(c)}
                >
                  {c}
                  <span className="info">i</span>
                  {active && <span className="check">✓</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Price types */}
        <div className="col-span-12 lg:col-span-3 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-slate-800">Тип цены</h2>
            <button className="text-sm text-slate-500 hover:text-[color:var(--brand)] flex items-center gap-1">
              Старые цены <IconDoc className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {PRICE_TYPES.map((p) => (
              <div
                key={p.id}
                className={`radio-row ${priceType === p.id ? 'active' : ''}`}
                onClick={() => setPriceType(p.id)}
              >
                <span className="radio-dot" />
                <span className="text-sm">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order composition */}
      <div className="card p-5">
        <h2 className="text-[15px] font-semibold text-slate-800 mb-3">Состав заявки</h2>
        {selectedCats.length === 0 ? (
          <div className="text-center text-slate-400 py-12 text-sm">
            Выберите категорию товаров выше, чтобы добавить позиции в заявку
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="border-b border-slate-200 flex flex-wrap">
              {selectedCats.map((c) => (
                <div
                  key={c}
                  className={`tab ${activeTab === c ? 'active' : ''}`}
                  onClick={() => setActiveTab(c)}
                >
                  <span className="info inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-bold italic">i</span>
                  {c}
                </div>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mt-4">
              <div className="relative flex-1 max-w-md">
                <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск"
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/15 text-sm"
                />
              </div>
              <button
                onClick={() => setRows({})}
                className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-[color:var(--brand)] hover:bg-slate-50"
                title="Сбросить"
              >
                <IconRefresh className="w-4 h-4" />
              </button>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-left border-b border-slate-200">
                    <th className="py-3 pl-3 font-medium">Ассортимент</th>
                    <th className="py-3 font-medium text-right pr-6">Цена</th>
                    <th className="py-3 font-medium text-center">Блок</th>
                    <th className="py-3 font-medium text-center">Количество</th>
                    <th className="py-3 font-medium text-right pr-4">Объем</th>
                    <th className="py-3 font-medium text-right pr-3">Общая сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {tabProducts.map((p) => {
                    const st = rows[p.id] ?? { block: 0, qty: 0 };
                    const total = p.price * st.qty;
                    const vol = p.volume * st.qty;
                    return (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 fade-up">
                        <td className="py-3 pl-3">
                          <div className="flex items-center gap-2 text-slate-700">
                            {p.name}
                            <span className="info inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-white text-[10px] font-bold italic">i</span>
                          </div>
                        </td>
                        <td className="py-3 text-right pr-6 text-slate-700">{formatMoney(p.price)}</td>
                        <td className="py-3 text-center">
                          <input
                            className="num-input"
                            type="number"
                            min={0}
                            value={st.block || ''}
                            onChange={(e) => setBlock(p.id, +e.target.value || 0, p.perBlock)}
                          />
                        </td>
                        <td className="py-3 text-center">
                          <input
                            className="num-input"
                            type="number"
                            min={0}
                            value={st.qty || ''}
                            onChange={(e) => setQty(p.id, +e.target.value || 0, p.perBlock)}
                          />
                        </td>
                        <td className="py-3 text-right pr-4 text-slate-500">
                          {vol > 0 ? vol.toFixed(3) : '0'}
                        </td>
                        <td className="py-3 text-right pr-3 font-medium text-slate-800">
                          {total > 0 ? formatMoney(total) : '0'}
                        </td>
                      </tr>
                    );
                  })}
                  {tabProducts.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">Ничего не найдено</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="text-slate-700 font-semibold">
                    <td className="py-3 pl-3">Итого</td>
                    <td />
                    <td />
                    <td className="text-center">{tabTotalQty}</td>
                    <td />
                    <td className="text-right pr-3">{formatMoney(tabTotalSum)} So'm</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <SummaryCard
                icon={<IconCube className="w-6 h-6 text-white" />}
                bg="bg-emerald-500"
                value={`${totals.volume.toFixed(2)} м³`}
                label="Общий объем"
              />
              <SummaryCard
                icon={<IconList className="w-6 h-6 text-white" />}
                bg="bg-orange-400"
                value={`${totals.qty} шт`}
                label="Общий количество"
              />
              <SummaryCard
                icon={<IconWallet className="w-6 h-6 text-white" />}
                bg="bg-teal-600"
                value={`${formatMoney(totals.sum)} So'm`}
                label="Общая сумма"
              />
            </div>

            {/* Note */}
            <div className="mt-6 max-w-xl space-y-2">
              <div className="field">
                <label>Примечание к заказу</label>
                <select defaultValue="">
                  <option value="">— Выберите шаблон —</option>
                  <option>Брак при транспортировке</option>
                  <option>Истёк срок годности</option>
                  <option>Не соответствует артикулу</option>
                </select>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Введите примечание..."
                className="w-full min-h-[90px] border border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/15"
              />
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => alert(`Возврат создан\nПозиций: ${totals.qty}\nСумма: ${formatMoney(totals.sum)} So'm`)}
                className="btn-primary"
              >
                Возврат
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, bg, value, label }: {
  icon: React.ReactNode; bg: string; value: string; label: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${bg}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
