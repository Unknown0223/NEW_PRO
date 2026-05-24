import { useState, useMemo } from "react";
import { Icon } from "../Icon";
import { useRefundStore } from "../../store/refundStore";
import { formatMoney, formatNumber } from "../../utils/format";
import { PRODUCTS } from "../../data/mock";
import type { CategoryKey } from "../../types/refund";

const CATEGORY_COLORS: Record<CategoryKey, { bg: string; text: string; badge: string; border: string }> = {
  Monno: { bg: "bg-rose-50", text: "text-rose-700", badge: "bg-rose-500 text-white", border: "border-rose-200" },
  Lalaku: { bg: "bg-amber-50", text: "text-amber-800", badge: "bg-amber-500 text-white", border: "border-amber-200" },
  Yoyoki: { bg: "bg-sky-50", text: "text-sky-800", badge: "bg-sky-500 text-white", border: "border-sky-200" },
  Sof: { bg: "bg-emerald-50", text: "text-emerald-800", badge: "bg-emerald-500 text-white", border: "border-emerald-200" },
  Sahara: { bg: "bg-violet-50", text: "text-violet-800", badge: "bg-violet-500 text-white", border: "border-violet-200" },
};

export default function ProductTable() {
  const {
    search, setSearch, items, setQuantity, removeItem, priceType, getFilteredProducts, selectedCategories,
  } = useRefundStore();

  const [activeTab, setActiveTab] = useState<string>("all");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const getQty = (productId: number) =>
    items.find((i) => i.productId === productId)?.quantity ?? 0;

  // Barcha filtrlangan mahsulotlar (kategoriya checkbox va qidiruv bo'yicha)
  const allFiltered = getFilteredProducts();

  // Tablar bo'yicha qo'shimcha filtr
  const displayedProducts = useMemo(() => {
    if (activeTab === "all") return allFiltered;
    return allFiltered.filter((p) => p.category === activeTab);
  }, [allFiltered, activeTab]);

  // Kategoriya bo'yicha statistika (nechta tovar va qancha summa savatga qo'shilgan)
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalQty: number; amount: number }> = {
      all: { count: 0, totalQty: 0, amount: 0 },
    };

    // Initialize stats for selected categories
    selectedCategories.forEach((cat) => {
      stats[cat] = { count: 0, totalQty: 0, amount: 0 };
    });

    // Calculate from cart items
    items.forEach((it) => {
      const p = PRODUCTS.find((prod) => prod.id === it.productId);
      if (p && selectedCategories.includes(p.category)) {
        const itemPrice = p.prices[priceType] ?? 0;
        const itemTotal = it.quantity * itemPrice;

        stats[p.category].count += 1;
        stats[p.category].totalQty += it.quantity;
        stats[p.category].amount += itemTotal;

        stats.all.count += 1;
        stats.all.totalQty += it.quantity;
        stats.all.amount += itemTotal;
      }
    });

    return stats;
  }, [items, priceType, selectedCategories]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-100">
            <Icon name="package" className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Ассортимент товаров</h2>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Шаг 4 из 5</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              В возврате: <span className="font-bold text-indigo-600">{categoryStats.all.totalQty} шт</span> на сумму <span className="font-bold text-slate-800">{formatMoney(categoryStats.all.amount)}</span>
            </p>
          </div>
        </div>

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или штрихкоду..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-16 text-sm font-medium outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 sm:w-96 shadow-inner"
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-500 font-bold sm:block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Горизонтальные вкладки по категориям (yonga taxlanadigan) */}
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === "all"
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            }`}
          >
            <Icon name="grid" className="h-4 w-4" />
            <span>Все товары</span>
            {categoryStats.all.totalQty > 0 && (
              <span className={`ml-1.5 flex h-5.5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none ${
                activeTab === "all" ? "bg-indigo-500 text-white" : "bg-indigo-600 text-white"
              }`}>
                {categoryStats.all.totalQty}
              </span>
            )}
          </button>

          {selectedCategories.map((catKey) => {
            const isSelected = activeTab === catKey;
            const stats = categoryStats[catKey] ?? { count: 0, totalQty: 0, amount: 0 };

            return (
              <button
                key={catKey}
                onClick={() => setActiveTab(catKey)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : `border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`
                }`}
              >
                <span>{catKey}</span>
                {stats.totalQty > 0 && (
                  <span className={`ml-1.5 flex h-5.5 min-w-[22px] items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none ${
                    isSelected ? "bg-white text-indigo-600 shadow-inner" : "bg-indigo-600 text-white shadow-sm"
                  }`}>
                    {stats.totalQty}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Жадвал */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-3.5 text-left w-12">#</th>
              <th className="px-6 py-3.5 text-left min-w-[280px]">Ассортимент / Категория</th>
              <th className="px-6 py-3.5 text-right font-mono">Цена</th>
              <th className="px-6 py-3.5 text-center">Объем / Ед.</th>
              <th className="px-6 py-3.5 text-center min-w-[240px]">Ввод количества (шт/упак)</th>
              <th className="px-6 py-3.5 text-right min-w-[140px]">Сумма возврата</th>
              <th className="px-6 py-3.5 text-center w-16">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-slate-500">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                      <Icon name="search" className="h-8 w-8 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-slate-800">В этой категории нет товаров</p>
                      <p className="text-xs text-slate-500 mt-1">Попробуйте выбрать другую вкладку или сбросить поисковый запрос</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              displayedProducts.map((p, idx) => {
                const qty = getQty(p.id);
                const price = p.prices[priceType];
                const total = qty * price;
                const inCart = qty > 0;
                const isHovered = hoveredId === p.id;
                const catBadge = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS.Monno;

                return (
                  <tr
                    key={p.id}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`transition duration-150 ${
                      inCart ? "bg-indigo-50/40 font-medium" : isHovered ? "bg-slate-50/80" : "bg-white"
                    }`}
                  >
                    <td className="px-6 py-4 text-xs font-semibold text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                          inCart ? "border-indigo-300 bg-indigo-100 text-indigo-700" : "border-slate-200 bg-slate-100 text-slate-500"
                        }`}>
                          <Icon name="barcode" className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 leading-tight">{p.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-semibold">{p.barcode}</span>
                            <span>•</span>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}>
                              {p.category}
                            </span>
                            {p.composition && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500 truncate max-w-[150px]">{p.composition}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-800">
                      {formatMoney(price)}
                    </td>
                    <td className="px-6 py-4 text-center text-xs text-slate-600 font-semibold">
                      {formatNumber(p.unitVolume, 3)} L <span className="text-slate-400">({p.unit})</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setQuantity(p.id, Math.max(0, qty - 1))}
                          disabled={qty === 0}
                          title="Уменьшить на 1"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Icon name="minus" className="h-4 w-4" />
                        </button>

                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            value={qty || ""}
                            onChange={(e) =>
                              setQuantity(p.id, Math.max(0, Number(e.target.value) || 0))
                            }
                            placeholder="0"
                            className={`w-20 rounded-xl border py-1.5 text-center text-sm font-bold shadow-sm outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 ${
                              inCart ? "border-indigo-500 bg-indigo-50/80 text-indigo-950 font-black" : "border-slate-300 bg-white text-slate-900"
                            }`}
                          />
                          {inCart && (
                            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                              ✓
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => setQuantity(p.id, qty + 1)}
                          title="Увеличить на 1"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-indigo-600 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
                        >
                          <Icon name="plus" className="h-4 w-4" />
                        </button>

                        {/* Tezkor tugmalar agentlar uchun */}
                        <div className="hidden ml-2 items-center gap-1 sm:flex border-l border-slate-200 pl-2">
                          <button
                            onClick={() => setQuantity(p.id, qty + 5)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95"
                          >
                            +5
                          </button>
                          <button
                            onClick={() => setQuantity(p.id, qty + 10)}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-indigo-600 hover:text-white hover:border-indigo-600 active:scale-95"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold">
                      {inCart ? (
                        <span className="text-indigo-600 font-extrabold">{formatMoney(total)}</span>
                      ) : (
                        <span className="text-slate-300 font-normal">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {inCart ? (
                        <button
                          onClick={() => removeItem(p.id)}
                          title="Очистить позицию"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                        >
                          <Icon name="trash" className="h-4.5 w-4.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Summary bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-4 text-xs text-slate-600">
        <div>
          Показано <span className="font-bold text-slate-800">{displayedProducts.length}</span> товаров (всего в каталоге: {PRODUCTS.length})
        </div>
        {categoryStats.all.totalQty > 0 && (
          <div className="flex items-center gap-4 mt-2 sm:mt-0 font-medium">
            <span>Выбрано позиций: <strong className="text-slate-900">{items.length}</strong></span>
            <span className="h-4 w-px bg-slate-300" />
            <span>Общее количество: <strong className="text-slate-900">{categoryStats.all.totalQty} шт</strong></span>
            <span className="h-4 w-px bg-slate-300" />
            <span>Сумма по полке: <strong className="text-indigo-600 font-bold font-mono text-sm">{formatMoney(categoryStats.all.amount)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
