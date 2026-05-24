import { Icon } from "../Icon";
import { useRefundStore } from "../../store/refundStore";
import { COMPOSITIONS, PRICE_TYPES } from "../../data/mock";
import type { CategoryKey } from "../../types/refund";

const CATEGORIES: { key: CategoryKey; label: string; color: string; bgLight: string; borderLight: string }[] = [
  { key: "Monno", label: "Monno", color: "from-rose-500 to-pink-600", bgLight: "bg-rose-50 text-rose-700", borderLight: "border-rose-200" },
  { key: "Lalaku", label: "Lalaku", color: "from-amber-500 to-orange-600", bgLight: "bg-amber-50 text-amber-800", borderLight: "border-amber-200" },
  { key: "Yoyoki", label: "Yoyoki", color: "from-sky-500 to-blue-600", bgLight: "bg-sky-50 text-sky-800", borderLight: "border-sky-200" },
  { key: "Sof", label: "Sof", color: "from-emerald-500 to-teal-600", bgLight: "bg-emerald-50 text-emerald-800", borderLight: "border-emerald-200" },
  { key: "Sahara", label: "Sahara", color: "from-violet-500 to-purple-600", bgLight: "bg-violet-50 text-violet-800", borderLight: "border-violet-200" },
];

export default function CategorySelector() {
  const {
    selectedCategories, toggleCategory, selectAllCategories,
    compositions, toggleComposition,
    priceType, setPriceType,
  } = useRefundStore();

  const allSelected = selectedCategories.length === CATEGORIES.length;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-100">
            <Icon name="grid" className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Фильтры ассортимента</h2>
            <p className="text-xs text-slate-500">Выберите категории и группы товаров для отображения на полке</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Шаг 3 из 5</span>
      </div>

      {/* Categories Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Категории на полке</label>
          <button
            onClick={() => selectAllCategories(!allSelected)}
            className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            {allSelected ? "Снять все отметки" : "Выбрать все категории"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            onClick={() => selectAllCategories(true)}
            className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition ${
              allSelected
                ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-sm"
                : "border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              allSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white"
            }`}>
              {allSelected && <Icon name="check" className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
            <span className="text-xs font-bold">Все бренды</span>
          </button>

          {CATEGORIES.map((c) => {
            const active = selectedCategories.includes(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition ${
                  active
                    ? `border-slate-800 ${c.bgLight} shadow-sm`
                    : "border-slate-100 bg-slate-50/50 text-slate-500 hover:border-slate-200"
                }`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
                }`}>
                  {active && <Icon name="check" className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${c.color}`} />
                    <span className="truncate text-xs font-bold leading-tight">{c.label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Compositions / Groups */}
        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">
            Группы и линейки товаров ({compositions.length ? `выбрано: ${compositions.length}` : "все"})
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPOSITIONS.map((comp) => {
              const active = compositions.includes(comp);
              return (
                <button
                  key={comp}
                  onClick={() => toggleComposition(comp)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {active ? <Icon name="check" className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
                  {comp}
                </button>
              );
            })}
          </div>
        </div>

        {/* Price Type Selection */}
        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">Тип расчета цен</label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {PRICE_TYPES.map((p) => {
              const active = priceType === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPriceType(p.key)}
                  className={`flex flex-col items-start justify-center rounded-xl border-2 p-3 transition ${
                    active
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 shadow-sm ring-1 ring-emerald-600/20"
                      : "border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Прайс-лист</span>
                  <span className="mt-0.5 text-xs font-bold">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
