import { useEffect, useMemo, useState, type ReactNode, type UIEvent } from "react";

type DateType = "order" | "shipment" | "delivery" | "created";
type SortDirection = "asc" | "desc";

type FinanceFilters = {
  dateType: DateType;
  startDate: string;
  endDate: string;
  supervisor: string;
  agent: string;
  territories: string[];
  customerCategories: string[];
  productCategories: string[];
  status: string;
};

type SalesMetric = {
  label: string;
  value: number;
  helper: string;
  tone: "teal" | "sky" | "amber" | "violet" | "emerald";
};

type FinanceCategory = {
  name: string;
  total: number;
  terminal: number;
  transfer: number;
  cash: number;
  tenge: number;
  share: number;
};

type TerritoryDebt = {
  territory: string;
  total: number;
  terminal: number;
  transfer: number;
  cash: number;
  tenge: number;
};

type Balance = {
  uzs: number;
  transfer: number;
  terminal: number;
  cash: number;
  tenge: number;
};

type PeriodPoint = {
  date: string;
  income: number;
  debt: number;
};

type CustomerDebt = {
  id: number;
  client: string;
  total: number;
  oldDebt: number;
  terminal: number;
  transfer: number;
  cash: number;
  riyal: number;
};

type TableColumn<T> = {
  id: string;
  label: string;
  className?: string;
  value: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string;
  csvValue?: (row: T) => number | string;
};

const compactNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const shortNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const initialFilters: FinanceFilters = {
  dateType: "order",
  startDate: "2026-04-21",
  endDate: "2026-05-21",
  supervisor: "all",
  agent: "all",
  territories: [],
  customerCategories: [],
  productCategories: [],
  status: "all",
};

const salesMetrics: SalesMetric[] = [
  { label: "Naqd", value: 77_910_411_200, helper: "cash collection", tone: "teal" },
  { label: "Pereches", value: 7_582_854_300, helper: "bank transfer", tone: "sky" },
  { label: "Tenge", value: 6_919_335.4, helper: "foreign cash", tone: "amber" },
  { label: "Terminal", value: 6_667_076_728.84, helper: "card acquiring", tone: "violet" },
  { label: "UZS Total", value: 92_333_325_613.84, helper: "all channels", tone: "emerald" },
];

const categories: FinanceCategory[] = [
  {
    name: "Kattalar tagligi (max)",
    total: 1_174_368_025,
    terminal: 47_721_000,
    transfer: 56_065_000,
    cash: 1_066_266_000,
    tenge: 172_641,
    share: 1.27,
  },
  {
    name: "Lalaku ECONOM (trusik) 2026",
    total: 17_959_931_250,
    terminal: 1_478_236_000,
    transfer: 1_683_774_000,
    cash: 14_797_244_000,
    tenge: 27_090,
    share: 19.45,
  },
  {
    name: "Reverem SB 0.33L",
    total: 2_637_900,
    terminal: 410_400,
    transfer: 60_000,
    cash: 2_167_500,
    tenge: 0,
    share: 0,
  },
  {
    name: "Lalaku Lipuchka Super mini",
    total: 4_268_500,
    terminal: 0,
    transfer: 0,
    cash: 4_268_500,
    tenge: 0,
    share: 0,
  },
  {
    name: "Salfetka (vlajniy)",
    total: 600_500,
    terminal: 0,
    transfer: 0,
    cash: 600_500,
    tenge: 0,
    share: 0,
  },
  {
    name: "SOF",
    total: 1_347_194_200,
    terminal: 21_670_000,
    transfer: 54_010_000,
    cash: 1_271_514_200,
    tenge: 0,
    share: 1.46,
  },
  {
    name: "Maska",
    total: 74_992_900,
    terminal: 1_108_000,
    transfer: 2_533_300,
    cash: 71_351_600,
    tenge: 0,
    share: 0.08,
  },
  {
    name: "Bonus",
    total: 0,
    terminal: 0,
    transfer: 0,
    cash: 0,
    tenge: 0,
    share: 0,
  },
  {
    name: "Monno trusik mega",
    total: 3_415_494_415,
    terminal: 89_376_000,
    transfer: 311_604_000,
    cash: 3_005_090_000,
    tenge: 376_976.6,
    share: 3.7,
  },
  {
    name: "Lalaku premium trusik",
    total: 47_861_485,
    terminal: 2_688_000,
    transfer: 11_423_000,
    cash: 33_504_900,
    tenge: 9_823.4,
    share: 0.05,
  },
  {
    name: "Lalaku classic",
    total: 9_608_840_000,
    terminal: 740_100_000,
    transfer: 958_700_000,
    cash: 7_910_040_000,
    tenge: 0,
    share: 10.4,
  },
  {
    name: "Food and pharma retail",
    total: 6_240_320_000,
    terminal: 380_150_000,
    transfer: 410_000_000,
    cash: 5_450_170_000,
    tenge: 0,
    share: 6.76,
  },
  {
    name: "Cosmetics wholesale",
    total: 4_851_220_000,
    terminal: 280_410_000,
    transfer: 342_200_000,
    cash: 4_228_610_000,
    tenge: 0,
    share: 5.25,
  },
  {
    name: "Other categories",
    total: 45_603_442_138.84,
    terminal: 3_625_223_328.84,
    transfer: 3_752_485_000,
    cash: 39_065_168_700,
    tenge: 6_332_804.4,
    share: 51.58,
  },
];

const territories: TerritoryDebt[] = [
  { territory: "NARPAY", total: 31_266_000, terminal: 31_266_000, transfer: 0, cash: 0, tenge: 0 },
  { territory: "KARMANA", total: 109_785_600, terminal: 976_000, transfer: 4_146_600, cash: 104_663_000, tenge: 0 },
  { territory: "BAXMAL", total: 47_088_600, terminal: 0, transfer: 555_000, cash: 46_533_600, tenge: 0 },
  { territory: "UCHTEPA", total: 5_415_247_508, terminal: 281_805_600, transfer: 120_194_760, cash: 5_013_247_148, tenge: 0 },
  { territory: "KIBRAY", total: 139_142_873, terminal: 0, transfer: 46_896_742, cash: 92_246_131, tenge: 0 },
  { territory: "G'UZOR", total: 94_261_600, terminal: 27_831_100, transfer: 10_346_000, cash: 56_084_500, tenge: 0 },
  { territory: "KOSONSOY", total: 159_968_071.7, terminal: 0, transfer: 3_503_000, cash: 156_465_071.7, tenge: 0 },
  { territory: "FARGONABOZOR", total: 302_311_580, terminal: 0, transfer: 0, cash: 302_311_580, tenge: 0 },
  { territory: "BOGDOD", total: 76_848_300, terminal: 0, transfer: 8_685_400, cash: 68_162_900, tenge: 0 },
  { territory: "DO'STLIK", total: 36_679_600, terminal: 0, transfer: 840_000, cash: 35_839_600, tenge: 0 },
  { territory: "YANGIYOL", total: 1_854_601_200, terminal: 440_000_000, transfer: 145_900_000, cash: 1_268_701_200, tenge: 1_900_000 },
  { territory: "QARSHI", total: 2_509_320_450, terminal: 590_333_140, transfer: 294_510_000, cash: 1_624_477_310, tenge: 2_100_000 },
  { territory: "CHILONZOR", total: 3_120_009_320, terminal: 858_990_000, transfer: 662_415_000, cash: 1_598_604_320, tenge: 1_882_984.5 },
];

const balance: Balance = {
  uzs: -56_245_193_152.38,
  transfer: -4_080_357_303.48,
  terminal: -13_081_463_686.45,
  cash: -38_898_959_759.95,
  tenge: -7_285_433.9,
};

const periodBalance: Balance = {
  uzs: 16_970_759_881.32,
  transfer: -633_732_249.1,
  terminal: -2_151_186_033.93,
  cash: 11_383_038_696.19,
  tenge: -4_559_998.9,
};

const periodPoints: PeriodPoint[] = [
  { date: "Jan", income: 9_200_000_000, debt: 8_500_000_000 },
  { date: "Feb", income: 12_400_000_000, debt: 10_100_000_000 },
  { date: "Mar", income: 10_700_000_000, debt: 11_900_000_000 },
  { date: "Apr", income: 14_200_000_000, debt: 12_300_000_000 },
  { date: "May", income: 16_970_759_881, debt: 15_400_000_000 },
  { date: "Jun", income: 13_800_000_000, debt: 14_100_000_000 },
  { date: "Jul", income: 18_400_000_000, debt: 13_300_000_000 },
  { date: "Aug", income: 17_700_000_000, debt: 11_800_000_000 },
  { date: "Sep", income: 19_300_000_000, debt: 12_700_000_000 },
  { date: "Oct", income: 16_500_000_000, debt: 10_900_000_000 },
  { date: "Nov", income: 18_900_000_000, debt: 9_800_000_000 },
  { date: "Dec", income: 20_100_000_000, debt: 8_900_000_000 },
];

const colorSet = [
  "#15b8d8",
  "#0ea5e9",
  "#22c55e",
  "#a3e635",
  "#f97316",
  "#ef4444",
  "#f472b6",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
  "#84cc16",
  "#db2777",
  "#2563eb",
  "#92400e",
];

const agentOptions = [
  "01 (ELDAR) GGTSH005-[AYMUXAMEDOVA XURSHIDA] (CHILONZOR) 18/05/26",
  "01 - GGAN002 - (SH) [VAKANT]",
  "01 - GGFA002 - (D) [TESHABOYEVA MAXSUDA] 10/09",
  "02 - TOSHKENT SAVDO AGENTI",
  "03 - QARSHI HUDUD AGENTI",
];
const territoryOptions = ["FV", "QOZOG'ISTON", "SAUDIYA ARABISTON", "SOUTH-WEST", "TOSHKENT", "UCHTEPA", "KARMANA", "CHILONZOR", "QARSHI", "NARPAY", "KIBRAY"];
const customerCategoryOptions = ["A class", "B class", "C class", "YTT", "Market", "Pharma"];
const productCategoryOptions = ["Lalaku", "SOF", "Maska", "Salfetka", "Other"];

function App() {
  return <FinanceDashboard />;
}

function FinanceDashboard() {
  const [filters, setFilters] = useState<FinanceFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<FinanceFilters>(initialFilters);
  const [refreshKey, setRefreshKey] = useState(1);

  const customers = useMemo(() => createCustomerRows(11_478), []);
  const filteredCategories = useMemo(
    () => filterCategoriesByProduct(categories, appliedFilters.productCategories),
    [appliedFilters.productCategories],
  );
  const filteredTerritories = useMemo(
    () => filterTerritories(territories, appliedFilters.territories),
    [appliedFilters.territories],
  );

  const applyFilters = () => {
    setAppliedFilters(filters);
    setRefreshKey((value) => value + 1);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-[#eef2f5] text-slate-800">
      <Sidebar />
      <div className="lg:pl-[250px]">
        <TopBar refreshKey={refreshKey} />
        <main className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-5 sm:px-6 xl:px-8">
          <FinanceFiltersPanel filters={filters} onChange={setFilters} onApply={applyFilters} onReset={resetFilters} />
          <div className="flex flex-col gap-6">
            <section className="motion-fade min-w-0">
              <KPISection metrics={salesMetrics} />
            </section>
            <section className="motion-fade min-w-0" style={{ animationDelay: "80ms" }}>
              <BalanceCards title="Общий баланс" subtitle="с учётом предоплаты" balance={balance} />
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="motion-slide min-w-0 xl:col-span-7">
              <CategoryDistribution categories={filteredCategories} />
            </section>
            <section className="motion-slide min-w-0 xl:col-span-5" style={{ animationDelay: "100ms" }}>
              <DebtDistribution paid={53} debt={47} />
            </section>
          </div>

          <section className="motion-fade" style={{ animationDelay: "140ms" }}>
            <PeriodAnalytics points={periodPoints} periodBalance={periodBalance} />
          </section>

          <CategoryAnalyticsTable categories={filteredCategories} />
          <TerritoryDebtTable territories={filteredTerritories} />
          <CustomerLedger customers={customers} />
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const navItems = [
    "Дашборды",
    "Супервайзер",
    "Финансы",
    "Дашборд продаж",
    "Заявки",
    "Клиенты",
    "Накладные",
    "Касса",
    "Склад",
    "Поставщики",
    "Планы",
    "Отчёт",
    "Pivot отчеты",
    "Пользователи",
    "Аудит",
    "Доступ",
    "Настройки",
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col bg-[#00443f] px-4 py-5 text-white lg:flex">
      <div className="mb-6 flex justify-center">
        <div className="h-11 w-11 rounded-xl bg-white" />
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {navItems.map((item) => {
          const active = item === "Финансы";
          const group = item === "Дашборды" || item === "Заявки" || item === "Клиенты" || item === "Настройки";
          return (
            <button
              key={item}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-medium transition ${
                active ? "bg-white/14 text-white" : group ? "text-white hover:bg-white/10" : "text-teal-50/85 hover:bg-white/8"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-300/18 text-[10px] font-bold text-cyan-200">
                {item.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1 truncate">{item}</span>
              {group ? <ChevronRight className="h-3.5 w-3.5 opacity-70" /> : <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function TopBar({ refreshKey }: { refreshKey: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
        <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700">
          GPS
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-500">/dashboard/finance</p>
          <h1 className="truncate text-lg font-semibold text-slate-900">Finance Analytics Dashboard</h1>
        </div>
        <div className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 md:block">
          Cache refresh #{refreshKey}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-sm font-bold text-white shadow-sm">
          FA
        </div>
      </div>
    </header>
  );
}

function FinanceFiltersPanel({
  filters,
  onChange,
  onApply,
  onReset,
}: {
  filters: FinanceFilters;
  onChange: (next: FinanceFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const update = <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleMulti = (key: "territories" | "customerCategories" | "productCategories", value: string) => {
    const current = filters[key];
    update(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-600">Finance module</p>
          <h2 className="text-xl font-bold text-slate-950">Финансы</h2>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
          <fieldset className="min-w-0 rounded-xl border border-slate-200 px-3 py-2">
            <legend className="px-1 text-xs font-medium text-slate-500">Дата применяется по</legend>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {dateTypeOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    className="h-4 w-4 accent-teal-600"
                    type="radio"
                    name="dateType"
                    value={option.value}
                    checked={filters.dateType === option.value}
                    onChange={() => update("dateType", option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <DateRangeControl
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartChange={(value) => update("startDate", value)}
            onEndChange={(value) => update("endDate", value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_44px_160px]">
        <SelectField
          label="Супервайзер"
          value={filters.supervisor}
          onChange={(value) => update("supervisor", value)}
          options={["all", "Alisher", "Madina", "Sardor"]}
        />
        <SelectField
          label="Агент"
          value={filters.agent}
          onChange={(value) => update("agent", value)}
          options={["all", ...agentOptions]}
        />
        <MultiCheckField
          label="Территория"
          selected={filters.territories}
          options={territoryOptions}
          onToggle={(value) => toggleMulti("territories", value)}
          onSetSelected={(values: string[]) => update("territories", values)}
        />
        <MultiCheckField
          label="Категория клиента"
          selected={filters.customerCategories}
          options={customerCategoryOptions}
          onToggle={(value) => toggleMulti("customerCategories", value)}
          onSetSelected={(values: string[]) => update("customerCategories", values)}
        />
        <MultiCheckField
          label="Категория продукта"
          selected={filters.productCategories}
          options={productCategoryOptions}
          onToggle={(value) => toggleMulti("productCategories", value)}
          onSetSelected={(values: string[]) => update("productCategories", values)}
        />
        <SelectField
          label="Статус"
          value={filters.status}
          onChange={(value) => update("status", value)}
          options={["all", "paid", "debt", "partial"]}
        />
        <button
          className="h-12 rounded-xl bg-teal-500/50 px-3 text-sm font-bold text-white transition hover:bg-teal-600 md:col-span-1 xl:col-span-1"
          onClick={onReset}
          title="Сбросить"
          aria-label="Сбросить"
        >
          <FilterOffIcon className="mx-auto h-5 w-5" />
        </button>
        <button
          className="h-12 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm shadow-teal-200 transition hover:bg-teal-700 md:col-span-1 xl:col-span-1"
          onClick={onApply}
        >
          Применить
        </button>
      </div>
    </section>
  );
}

const dateTypeOptions: { value: DateType; label: string }[] = [
  { value: "order", label: "Дата заказа" },
  { value: "shipment", label: "Дата отправки" },
  { value: "delivery", label: "Дата доставки" },
  { value: "created", label: "Дата создания" },
];

function SelectField({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const visibleOptions = options.filter((option) => getOptionLabel(option, label).toLowerCase().includes(query.toLowerCase()));
  const selectedLabel = value === "all" ? label : getOptionLabel(value, label);

  return (
    <details className={`group relative ${className}`}>
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition marker:hidden hover:border-teal-300 group-open:rounded-b-none group-open:border-teal-500">
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className="h-4 w-4 rotate-90 text-slate-400 transition group-open:-rotate-90" />
      </summary>
      <div className="absolute left-0 right-0 z-50 overflow-hidden rounded-b-xl border border-t-0 border-slate-200 bg-white shadow-xl shadow-slate-200/80">
        <label className="relative block border-b border-slate-200">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full px-9 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="max-h-[282px] overflow-y-auto p-2">
          {visibleOptions.map((option) => {
            const display = getOptionLabel(option, label);
            const selected = value === option;
            return (
              <button
                key={option}
                className={`flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${selected ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-50"}`}
                onClick={() => onChange(option)}
              >
                <span className={`mt-0.5 h-5 w-5 rounded border ${selected ? "border-teal-500 bg-teal-500" : "border-slate-200 bg-white"}`}>
                  {selected ? <CheckIcon className="h-full w-full p-0.5 text-white" /> : null}
                </span>
                <span className="min-w-0 flex-1 leading-5">{display}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function DateRangeControl({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"date" | "month">("date");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseIsoDate(startDate)));
  const [activeEdge, setActiveEdge] = useState<"start" | "end">("start");

  const moveRange = (direction: -1 | 1) => {
    const [nextStart, nextEnd] = shiftDateRange(startDate, endDate, direction);
    onStartChange(nextStart);
    onEndChange(nextEnd);
  };

  const selectDay = (date: Date) => {
    const next = toIsoDate(date);
    if (activeEdge === "start") {
      if (date.getTime() > parseIsoDate(endDate).getTime()) {
        onStartChange(next);
        onEndChange(next);
      } else {
        onStartChange(next);
      }
      setActiveEdge("end");
      return;
    }
    if (date.getTime() < parseIsoDate(startDate).getTime()) {
      onStartChange(next);
    } else {
      onEndChange(next);
    }
    setActiveEdge("start");
  };

  const choosePreset = (preset: DatePreset) => {
    const [nextStart, nextEnd] = getPresetRange(preset);
    onStartChange(nextStart);
    onEndChange(nextEnd);
    setVisibleMonth(startOfMonth(parseIsoDate(nextStart)));
  };

  const chooseMonth = (monthIndex: number) => {
    const year = visibleMonth.getFullYear();
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    onStartChange(toIsoDate(start));
    onEndChange(toIsoDate(end));
    setVisibleMonth(startOfMonth(start));
  };

  return (
    <div className="relative flex h-12 min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white xl:min-w-[300px]">
      <button
        className="w-11 border-r border-slate-200 text-xl font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-teal-700"
        onClick={() => moveRange(-1)}
        aria-label="Предыдущий период"
      >
        ‹
      </button>
      <button
        className="flex min-w-0 flex-1 items-center gap-2 px-3 text-sm font-semibold text-slate-700"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-slate-500" />
        <span className="min-w-0 truncate">{formatDateDot(startDate)} - {formatDateDot(endDate)}</span>
      </button>
      <button
        className="w-11 border-l border-slate-200 text-xl font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-teal-700"
        onClick={() => moveRange(1)}
        aria-label="Следующий период"
      >
        ›
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(720px,calc(100vw-32px))] rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-300/60">
          <div className="absolute right-24 top-[-8px] h-4 w-4 rotate-45 border-l border-t border-slate-200 bg-white" />
          {viewMode === "date" ? (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_172px]">
              <div className="grid gap-4 p-3 sm:grid-cols-2">
                <CalendarMonth
                  month={visibleMonth}
                  startDate={startDate}
                  endDate={endDate}
                  onSelect={selectDay}
                  onPrevious={() => setVisibleMonth((date) => addMonths(date, -1))}
                />
                <CalendarMonth
                  month={addMonths(visibleMonth, 1)}
                  startDate={startDate}
                  endDate={endDate}
                  onSelect={selectDay}
                  onNext={() => setVisibleMonth((date) => addMonths(date, 1))}
                />
              </div>
              <DateQuickActions onPreset={choosePreset} onModeChange={setViewMode} activeMode={viewMode} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_172px]">
              <MonthPickerPanel
                year={visibleMonth.getFullYear()}
                selectedStart={startDate}
                selectedEnd={endDate}
                onYearChange={(direction) => setVisibleMonth((date) => new Date(date.getFullYear() + direction, date.getMonth(), 1))}
                onSelectMonth={chooseMonth}
              />
              <DateQuickActions onPreset={choosePreset} onModeChange={setViewMode} activeMode={viewMode} />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CalendarMonth({
  month,
  startDate,
  endDate,
  onSelect,
  onPrevious,
  onNext,
}: {
  month: Date;
  startDate: string;
  endDate: string;
  onSelect: (date: Date) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const cells = getCalendarCells(month);

  return (
    <div className="min-w-0">
      <div className="mb-3 grid grid-cols-[32px_1fr_56px_32px] items-center gap-2 text-sm text-slate-700">
        <button className="h-8 rounded-lg text-2xl font-semibold text-teal-600 hover:bg-teal-50 disabled:opacity-0" onClick={onPrevious} disabled={!onPrevious}>
          ‹
        </button>
        <div className="text-center font-medium">{monthNamesShort[month.getMonth()]}</div>
        <div className="text-center font-medium">{month.getFullYear()}</div>
        <button className="h-8 rounded-lg text-2xl font-semibold text-teal-600 hover:bg-teal-50 disabled:opacity-0" onClick={onNext} disabled={!onNext}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-teal-600">
        {weekDays.map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
        {cells.map((cell) => {
          const selected = isSameDay(cell.date, start) || isSameDay(cell.date, end);
          const inRange = isBetweenDates(cell.date, start, end);
          return (
            <button
              key={cell.key}
              className={`h-9 rounded-sm transition ${
                selected
                  ? "bg-teal-600 font-bold text-white"
                  : inRange
                    ? "bg-teal-50 text-teal-700"
                    : cell.inMonth
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-300"
              }`}
              onClick={() => onSelect(cell.date)}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateQuickActions({
  onPreset,
  onModeChange,
  activeMode,
}: {
  onPreset: (preset: DatePreset) => void;
  onModeChange: (mode: "date" | "month") => void;
  activeMode: "date" | "month";
}) {
  return (
    <div className="border-t border-slate-200 p-3 md:border-l md:border-t-0">
      <div className="space-y-1 text-sm font-medium text-slate-600">
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("today")}>Сегодня</button>
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("yesterday")}>Вчера</button>
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("last7")}>Последние 7 дней</button>
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("last30")}>Последние 30 дней</button>
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("thisMonth")}>Этот месяц</button>
        <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => onPreset("lastMonth")}>Прошлый месяц</button>
        <button
          className={`w-full rounded-lg px-3 py-2 text-left ${activeMode === "month" ? "bg-teal-50 text-teal-700" : "hover:bg-slate-50"}`}
          onClick={() => onModeChange("month")}
        >
          Выбрать месяц
        </button>
        <button
          className={`w-full rounded-lg px-3 py-2 text-left ${activeMode === "date" ? "bg-teal-50 text-teal-700" : "hover:bg-slate-50"}`}
          onClick={() => onModeChange("date")}
        >
          Выбрать дату
        </button>
      </div>
    </div>
  );
}

function MonthPickerPanel({
  year,
  selectedStart,
  selectedEnd,
  onYearChange,
  onSelectMonth,
}: {
  year: number;
  selectedStart: string;
  selectedEnd: string;
  onYearChange: (direction: -1 | 1) => void;
  onSelectMonth: (monthIndex: number) => void;
}) {
  const start = parseIsoDate(selectedStart);
  const end = parseIsoDate(selectedEnd);

  return (
    <div className="p-3">
      <div className="mb-4 grid grid-cols-[40px_1fr_40px] items-center">
        <button className="h-9 rounded-lg text-2xl font-semibold text-teal-600 hover:bg-teal-50" onClick={() => onYearChange(-1)}>‹</button>
        <div className="text-center text-sm font-medium text-slate-700">{year}</div>
        <button className="h-9 rounded-lg text-2xl font-semibold text-teal-600 hover:bg-teal-50" onClick={() => onYearChange(1)}>›</button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        {monthNamesShort.map((label, index) => {
          const monthStart = new Date(year, index, 1);
          const monthEnd = new Date(year, index + 1, 0);
          const selected = monthStart.getTime() >= startOfMonth(start).getTime() && monthEnd.getTime() <= new Date(end.getFullYear(), end.getMonth() + 1, 0).getTime();
          return (
            <button
              key={label}
              className={`rounded-lg px-4 py-3 font-medium transition ${selected ? "bg-teal-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
              onClick={() => onSelectMonth(index)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiCheckField({
  label,
  selected,
  options,
  onToggle,
  onSetSelected,
  className = "",
}: {
  label: string;
  selected: string[];
  options: string[];
  onToggle: (value: string) => void;
  onSetSelected?: (values: string[]) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const visibleOptions = options.filter((option) => option.toLowerCase().includes(query.toLowerCase()));
  const allSelected = selected.length === options.length;

  return (
    <details className={`group relative ${className}`}>
      <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 outline-none transition marker:hidden hover:border-teal-300 group-open:rounded-b-none group-open:border-teal-500">
        <span className="truncate">{selected.length ? `${label}: ${selected.length}` : label}</span>
        <ChevronRight className="h-4 w-4 rotate-90 text-slate-400 transition group-open:-rotate-90" />
      </summary>
      <div className="absolute left-0 right-0 z-50 overflow-hidden rounded-b-xl border border-t-0 border-slate-200 bg-white shadow-xl shadow-slate-200/80">
        <label className="relative block border-b border-slate-200">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full px-9 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Поиск"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="max-h-[280px] overflow-y-auto p-2">
          <button
            className="mb-1 flex w-full items-center gap-3 rounded-lg bg-slate-50 px-2 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => {
              if (onSetSelected) {
                onSetSelected(allSelected ? [] : options);
                return;
              }
              options.forEach((option) => {
                if (allSelected || !selected.includes(option)) onToggle(option);
              });
            }}
          >
            <span className={`h-5 w-5 rounded border ${allSelected ? "border-teal-500 bg-teal-500" : "border-slate-200 bg-white"}`}>
              {allSelected ? <CheckIcon className="h-full w-full p-0.5 text-white" /> : null}
            </span>
            Выбрать все
          </button>
          {visibleOptions.map((option) => {
            const checked = selected.includes(option);
            const isTree = label === "Территория";
            return (
              <button key={option} className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => onToggle(option)}>
                {isTree ? <ChevronRight className="mt-1 h-3.5 w-3.5 text-slate-600" /> : null}
                <span className={`mt-0.5 h-5 w-5 shrink-0 rounded border ${checked ? "border-teal-500 bg-teal-500" : "border-slate-200 bg-white"}`}>
                  {checked ? <CheckIcon className="h-full w-full p-0.5 text-white" /> : null}
                </span>
                <span className="min-w-0 flex-1 leading-5">{option}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function KPISection({ metrics }: { metrics: SalesMetric[] }) {
  const channelMetrics = metrics.filter((metric) => metric.label !== "UZS Total");
  const total = metrics.find((metric) => metric.label === "UZS Total")?.value ?? channelMetrics.reduce((sum, metric) => sum + metric.value, 0);

  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title="Продажа" subtitle="Payment channel aggregation without squeezing on smaller screens" />
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((metric, index) => (
          <MetricTile key={metric.label} metric={metric} total={total} index={index} />
        ))}
      </div>
    </section>
  );
}

function MetricTile({ metric, total, index }: { metric: SalesMetric; total: number; index: number }) {
  const toneClass = {
    teal: "from-teal-500 to-cyan-400",
    sky: "from-sky-500 to-blue-400",
    amber: "from-amber-500 to-orange-400",
    violet: "from-violet-500 to-fuchsia-400",
    emerald: "from-emerald-500 to-teal-400",
  }[metric.tone];
  const solidToneClass = {
    teal: "bg-teal-500",
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
  }[metric.tone];
  const percent = metric.label === "UZS Total" ? 100 : total > 0 ? Math.min(100, Math.max(0, (metric.value / total) * 100)) : 0;

  return (
    <article className="motion-fade flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100" style={{ animationDelay: `${index * 55}ms` }}>
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${toneClass}`} />
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
            {formatPercent(percent)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-500">{metric.label}</p>
          <span className="text-xs font-bold text-slate-400">{metric.label === "UZS Total" ? "total" : "share"}</span>
        </div>
        <p className="mt-1 truncate text-[clamp(1.08rem,1.18vw,1.38rem)] font-black tracking-tight text-slate-950">{formatNumber(metric.value)}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{metric.helper}</p>
      </div>
      <div className="mt-5">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className={`motion-bar h-full rounded-full ${solidToneClass}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </article>
  );
}

function BalanceCards({ title, subtitle, balance }: { title: string; subtitle: string; balance: Balance }) {
  const items = [
    { label: "UZS", value: balance.uzs, accent: true },
    { label: "Pereches", value: balance.transfer, accent: false },
    { label: "Tenge", value: balance.tenge, accent: false },
    { label: "Terminal", value: balance.terminal, accent: false },
    { label: "Naqd", value: balance.cash, accent: false },
  ];

  return (
    <section className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className={`flex min-h-[98px] items-center rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100 ${item.accent ? "bg-gradient-to-r from-slate-50 to-cyan-50" : ""}`}>
            <div className="flex w-full items-center gap-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${item.value < 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                <p className={`mt-0.5 truncate text-[clamp(1.05rem,1.2vw,1.35rem)] font-black tracking-tight ${item.value < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {formatNumber(item.value)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryDistribution({ categories: rows }: { categories: FinanceCategory[] }) {
  const chartRows = useMemo(() => rows.filter((item) => item.total > 0).sort((a, b) => b.total - a.total), [rows]);
  const total = chartRows.reduce((sum, item) => sum + item.total, 0);
  const gradient = buildConicGradient(chartRows.map((item, index) => ({ value: item.total, color: colorSet[index % colorSet.length] })));

  return (
    <section className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title="По категориям" subtitle="Top categories stay readable with a scrollable legend" />
      <div className="grid min-h-[320px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(240px,320px),minmax(0,1fr)]">
        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full p-8 shadow-inner" style={{ background: gradient }}>
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-slate-100">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Total</span>
            <strong className="mt-1 text-2xl font-black text-slate-950">{shortNumber.format(total)}</strong>
            <span className="text-sm font-medium text-slate-500">UZS</span>
          </div>
        </div>
        <div className="max-h-[320px] min-w-0 space-y-2 overflow-y-auto pr-2">
          {chartRows.map((item, index) => (
            <div key={item.name} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
              <div className="mb-2 flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorSet[index % colorSet.length] }} />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.name}</p>
                <span className="text-sm font-black text-slate-700">{formatNumber(item.share)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="motion-bar h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, item.share)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DebtDistribution({ paid, debt }: { paid: number; debt: number }) {
  const gradient = `conic-gradient(#04b735 0 ${paid}%, #ffffff ${paid}% ${paid + 2}%, #e91d24 ${paid + 2}% 100%)`;

  return (
    <section className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title="По долгу" subtitle="Paid and debt ratio is separated from category volume" />
      <div className="grid min-h-[320px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(220px,280px),minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(220px,280px),minmax(0,1fr)]">
        <div className="mx-auto flex h-64 w-64 items-center justify-center rounded-full p-8 shadow-inner" style={{ background: gradient }}>
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-slate-100">
            <span className="text-sm font-semibold text-slate-500">Оплачено</span>
            <strong className="text-4xl font-black text-emerald-600">{paid}%</strong>
          </div>
        </div>
        <div className="space-y-3">
          <RatioLine label="Оплачено" value={paid} color="bg-emerald-500" />
          <RatioLine label="Долг" value={debt} color="bg-red-500" />
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600 ring-1 ring-slate-100">
            Formula: paid / (paid + debt). This block has its own column so charts do not push tables.
          </div>
        </div>
      </div>
    </section>
  );
}

function RatioLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
        <span className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${color}`} />
          {label}
        </span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`motion-bar h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PeriodAnalytics({ points, periodBalance: snapshot }: { points: PeriodPoint[]; periodBalance: Balance }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title="Долги и оплаты по периодам" subtitle="Cashflow trend is full-width, not squeezed into the right rail" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <CashflowChart points={points} />
        <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
          {[
            { label: "UZS", value: snapshot.uzs },
            { label: "Pereches", value: snapshot.transfer },
            { label: "Tenge", value: snapshot.tenge },
            { label: "Terminal", value: snapshot.terminal },
            { label: "Naqd", value: snapshot.cash },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-slate-100 ${item.label === "UZS" ? "sm:col-span-2 lg:col-span-1 2xl:col-span-2" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.value < 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
                <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              </div>
              <p className={`mt-1 truncate text-[clamp(1rem,1.04vw,1.2rem)] font-black ${item.value < 0 ? "text-rose-700" : "text-emerald-700"}`}>{formatNumber(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CashflowChart({ points }: { points: PeriodPoint[] }) {
  const width = 900;
  const height = 270;
  const padding = 36;
  const maxValue = Math.max(...points.flatMap((point) => [point.income, point.debt]));
  const scaleY = (value: number) => height - padding - (value / maxValue) * (height - padding * 2);
  const step = (width - padding * 2) / (points.length - 1);
  const debtPath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${padding + index * step} ${scaleY(point.debt)}`)
    .join(" ");

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <svg className="min-w-[760px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Payments and debts by period">
        {[0, 1, 2, 3].map((line) => {
          const y = padding + line * ((height - padding * 2) / 3);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#dbe3ea" strokeDasharray="5 8" />;
        })}
        {points.map((point, index) => {
          const x = padding + index * step;
          const barHeight = height - padding - scaleY(point.income);
          return (
            <g key={point.date}>
              <rect x={x - 14} y={scaleY(point.income)} width={28} height={barHeight} rx={8} fill="#14b8a6" opacity="0.82" />
              <text x={x} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[12px] font-semibold">
                {point.date}
              </text>
            </g>
          );
        })}
        <path className="chart-line" d={debtPath} fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={`${point.date}-debt`} cx={padding + index * step} cy={scaleY(point.debt)} r="5" fill="#ef4444" stroke="white" strokeWidth="3" />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 px-2 text-sm font-semibold text-slate-600">
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-teal-500" />Оплаты</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-red-500" />Долг</span>
      </div>
    </div>
  );
}

function CategoryAnalyticsTable({ categories: rows }: { categories: FinanceCategory[] }) {
  const columns: TableColumn<FinanceCategory>[] = [
    { id: "name", label: "Названия", value: (row) => row.name, sortValue: (row) => row.name, className: "text-left" },
    { id: "total", label: "Общая сумма", value: (row) => formatNumber(row.total), sortValue: (row) => row.total },
    { id: "terminal", label: "Terminal", value: (row) => formatNumber(row.terminal), sortValue: (row) => row.terminal },
    { id: "transfer", label: "Pereches", value: (row) => formatNumber(row.transfer), sortValue: (row) => row.transfer },
    { id: "cash", label: "Naqd", value: (row) => formatNumber(row.cash), sortValue: (row) => row.cash },
    { id: "tenge", label: "NAQD Tenge", value: (row) => formatNumber(row.tenge), sortValue: (row) => row.tenge },
    { id: "share", label: "Доля", value: (row) => `${formatNumber(row.share)}%`, sortValue: (row) => row.share },
  ];

  const totals = {
    name: "Итого",
    total: formatNumber(sumBy(rows, "total")),
    terminal: formatNumber(sumBy(rows, "terminal")),
    transfer: formatNumber(sumBy(rows, "transfer")),
    cash: formatNumber(sumBy(rows, "cash")),
    tenge: formatNumber(sumBy(rows, "tenge")),
    share: "100%",
  };

  return (
    <DataTable
      title="По категориям"
      subtitle="Full-width table with horizontal safety, sticky header, sorting, search and export"
      data={rows}
      columns={columns}
      totals={totals}
      searchKeys={[(row) => row.name]}
      exportFileName="finance-categories.csv"
      minWidth={1120}
    />
  );
}

function TerritoryDebtTable({ territories: rows }: { territories: TerritoryDebt[] }) {
  const columns: TableColumn<TerritoryDebt>[] = [
    { id: "territory", label: "Названия", value: (row) => row.territory, sortValue: (row) => row.territory, className: "text-left" },
    { id: "total", label: "Общая сумма", value: (row) => formatNumber(row.total), sortValue: (row) => row.total },
    { id: "terminal", label: "Terminal", value: (row) => formatNumber(row.terminal), sortValue: (row) => row.terminal },
    { id: "transfer", label: "Pereches", value: (row) => formatNumber(row.transfer), sortValue: (row) => row.transfer },
    { id: "cash", label: "Naqd", value: (row) => formatNumber(row.cash), sortValue: (row) => row.cash },
    { id: "tenge", label: "NAQD Tenge", value: (row) => formatNumber(row.tenge), sortValue: (row) => row.tenge },
  ];

  const totals = {
    territory: "Итого",
    total: formatNumber(sumBy(rows, "total")),
    terminal: formatNumber(sumBy(rows, "terminal")),
    transfer: formatNumber(sumBy(rows, "transfer")),
    cash: formatNumber(sumBy(rows, "cash")),
    tenge: formatNumber(sumBy(rows, "tenge")),
  };

  return (
    <DataTable
      title="Долги по территориям"
      subtitle="Server pagination friendly structure, no side-column compression"
      data={rows}
      columns={columns}
      totals={totals}
      searchKeys={[(row) => row.territory]}
      exportFileName="territory-debt.csv"
      minWidth={980}
    />
  );
}

function DataTable<T>({
  title,
  subtitle,
  data,
  columns,
  totals,
  searchKeys,
  exportFileName,
  minWidth,
}: {
  title: string;
  subtitle: string;
  data: T[];
  columns: TableColumn<T>[];
  totals?: Record<string, string>;
  searchKeys: Array<(row: T) => string>;
  exportFileName: string;
  minWidth: number;
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({ key: columns[0]?.id ?? "", direction: "asc" });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return data;
    return data.filter((row) => searchKeys.some((accessor) => accessor(row).toLowerCase().includes(normalized)));
  }, [data, query, searchKeys]);

  const sorted = useMemo(() => sortRows(filtered, columns, sort.key, sort.direction), [filtered, columns, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, data]);

  const handleSort = (key: string) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton onClick={() => exportCsv(exportFileName, columns, sorted)}>Excel</ToolbarButton>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-teal-500"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <label className="relative w-full lg:w-[320px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth }}>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.id} className={`border-b border-slate-200 px-3 py-3 text-right font-bold ${column.className ?? ""}`}>
                    <button className="inline-flex items-center gap-1" onClick={() => handleSort(column.id)}>
                      {column.label}
                      <SortIcon active={sort.key === column.id} direction={sort.direction} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-200/80 text-slate-700 transition hover:bg-teal-50/45">
                  {columns.map((column) => (
                    <td key={column.id} className={`px-3 py-3 text-right tabular-nums ${column.className ?? ""}`}>{column.value(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot className="sticky bottom-0 bg-slate-50 font-black text-slate-700">
                <tr>
                  {columns.map((column) => (
                    <td key={column.id} className={`border-t border-slate-200 px-3 py-3 text-right tabular-nums ${column.className ?? ""}`}>
                      {totals[column.id] ?? ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
      <Pagination page={safePage} pageCount={pageCount} pageSize={pageSize} total={sorted.length} onPageChange={setPage} />
    </section>
  );
}

function CustomerLedger({ customers }: { customers: CustomerDebt[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: keyof CustomerDebt; direction: SortDirection }>({ key: "total", direction: "asc" });
  const [loadedCount, setLoadedCount] = useState(180);
  const [scrollTop, setScrollTop] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 280);
  const rowHeight = 64;
  const viewportHeight = 520;
  const gridTemplateColumns = "minmax(280px,1.8fr) repeat(6,minmax(145px,1fr))";

  const filtered = useMemo(() => {
    const normalized = debouncedQuery.trim().toLowerCase();
    if (!normalized) return customers;
    return customers.filter((row) => row.client.toLowerCase().includes(normalized));
  }, [customers, debouncedQuery]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.direction));
    return rows;
  }, [filtered, sort]);

  const loadedRows = sorted.slice(0, Math.min(loadedCount, sorted.length));
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 6);
  const endIndex = Math.min(loadedRows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 6);
  const virtualRows = loadedRows.slice(startIndex, endIndex);

  useEffect(() => {
    setLoadedCount(180);
    setScrollTop(0);
  }, [debouncedQuery, sort]);

  const handleSort = (key: keyof CustomerDebt) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  };

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    if (target.scrollTop + target.clientHeight > target.scrollHeight - 500) {
      setLoadedCount((current) => Math.min(current + 220, sorted.length));
    }
  };

  const customerColumns: { key: keyof CustomerDebt; label: string; align?: string }[] = [
    { key: "client", label: "Client", align: "text-left" },
    { key: "total", label: "Total" },
    { key: "oldDebt", label: "Old Debt" },
    { key: "terminal", label: "Terminal" },
    { key: "transfer", label: "Transfer" },
    { key: "cash", label: "Cash" },
    { key: "riyal", label: "Riyal" },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <SectionHeader title="Список клиенты" subtitle="Customer ledger moved to full width with debounced search, virtual rows and infinite loading" />
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton onClick={() => exportCustomerCsv(sorted)}>Excel</ToolbarButton>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-100">
            Loaded {formatNumber(loadedRows.length)} / {formatNumber(sorted.length)}
          </div>
        </div>
        <label className="relative w-full lg:w-[360px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск клиента"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <div className="min-w-[1190px]">
          <div className="grid bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns }}>
            {customerColumns.map((column) => (
              <button
                key={column.key}
                className={`border-b border-slate-200 px-3 py-3 text-right ${column.align ?? ""}`}
                onClick={() => handleSort(column.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  <SortIcon active={sort.key === column.key} direction={sort.direction} />
                </span>
              </button>
            ))}
          </div>
          <div className="relative overflow-y-auto" style={{ height: viewportHeight }} onScroll={onScroll}>
            <div className="relative" style={{ height: loadedRows.length * rowHeight }}>
              {virtualRows.map((row, index) => {
                const absoluteIndex = startIndex + index;
                return (
                  <div
                    key={row.id}
                    className="absolute left-0 right-0 grid border-b border-slate-200/80 text-sm text-slate-700 transition hover:bg-teal-50/45"
                    style={{ gridTemplateColumns, height: rowHeight, transform: `translateY(${absoluteIndex * rowHeight}px)` }}
                  >
                    <div className="flex items-center px-3 font-semibold leading-5 text-slate-700">{row.client}</div>
                    <VirtualCell>{formatNumber(row.total)}</VirtualCell>
                    <VirtualCell>{formatNumber(row.oldDebt)}</VirtualCell>
                    <VirtualCell>{formatNumber(row.terminal)}</VirtualCell>
                    <VirtualCell>{formatNumber(row.transfer)}</VirtualCell>
                    <VirtualCell>{formatNumber(row.cash)}</VirtualCell>
                    <VirtualCell>{formatNumber(row.riyal)}</VirtualCell>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>Debounced search: 280ms. Virtualization keeps DOM rows near viewport only.</span>
        <span>Всего: {formatNumber(customers.length)} клиентов</span>
      </div>
    </section>
  );
}

function VirtualCell({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end px-3 text-right tabular-nums text-slate-700">{children}</div>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 min-w-0">
      <h2 className="text-lg font-black text-slate-800">{title}</h2>
      <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
    </div>
  );
}

function ToolbarButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
    >
      <DownloadIcon className="h-4 w-4 text-emerald-600" />
      {children}
    </button>
  );
}

function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount])).filter((value) => value >= 1 && value <= pageCount);

  return (
    <div className="mt-3 flex flex-col gap-3 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>Показано {formatNumber(start)} - {formatNumber(end)} / {formatNumber(total)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" onClick={() => onPageChange(Math.max(1, page - 1))}>‹</button>
        {pages.map((item, index) => {
          const previous = pages[index - 1];
          return (
            <span key={item} className="flex items-center gap-2">
              {previous && item - previous > 1 ? <span className="px-1 text-slate-400">...</span> : null}
              <button
                className={`h-9 min-w-9 rounded-lg px-3 font-bold transition ${item === page ? "bg-teal-600 text-white" : "border border-slate-200 text-slate-700 hover:border-teal-300"}`}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            </span>
          );
        })}
        <button className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" onClick={() => onPageChange(Math.min(pageCount, page + 1))}>›</button>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function FilterOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M4 6h9" />
      <path d="M17 6h3" />
      <path d="M6 12h6" />
      <path d="M15 12h3" />
      <path d="M10 18h4" />
    </svg>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  return <span className={`text-[10px] ${active ? "text-teal-600" : "text-slate-300"}`}>{direction === "asc" ? "▲" : "▼"}</span>;
}

function filterCategoriesByProduct(rows: FinanceCategory[], selected: string[]) {
  if (selected.length === 0) return rows;
  const normalized = selected.map((item) => item.toLowerCase());
  return rows.filter((row) => normalized.some((item) => row.name.toLowerCase().includes(item)) || normalized.includes("other"));
}

function filterTerritories(rows: TerritoryDebt[], selected: string[]) {
  if (selected.length === 0) return rows;
  return rows.filter((row) => selected.includes(row.territory));
}

function buildConicGradient(segments: { value: number; color: string }[]) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return "conic-gradient(#e2e8f0 0 100%)";
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + (segment.value / total) * 100;
    cursor = end;
    return `${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function sumBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

function sortRows<T>(rows: T[], columns: TableColumn<T>[], key: string, direction: SortDirection) {
  const column = columns.find((item) => item.id === key) ?? columns[0];
  if (!column) return rows;
  return [...rows].sort((a, b) => {
    const first = column.sortValue ? column.sortValue(a) : String(column.value(a));
    const second = column.sortValue ? column.sortValue(b) : String(column.value(b));
    return compareValues(first, second, direction);
  });
}

function compareValues(first: string | number, second: string | number, direction: SortDirection) {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  if (typeof first === "number" && typeof second === "number") {
    return (first - second) * directionMultiplier;
  }
  return String(first).localeCompare(String(second)) * directionMultiplier;
}

function getOptionLabel(option: string, placeholder: string) {
  const labels: Record<string, string> = {
    all: placeholder,
    paid: "Оплачено",
    debt: "Долг",
    partial: "Частично",
  };
  return labels[option] ?? option;
}

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth";

const monthNamesShort = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июнь", "Июль", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];
const weekDays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateDot(value: string) {
  const date = parseIsoDate(value);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function isBetweenDates(date: Date, start: Date, end: Date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return current >= Math.min(startTime, endTime) && current <= Math.max(startTime, endTime);
}

function getCalendarCells(month: Date) {
  const firstOfMonth = startOfMonth(month);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstOfMonth.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return {
      key: toIsoDate(date),
      date,
      inMonth: date.getMonth() === month.getMonth(),
    };
  });
}

function getPresetRange(preset: DatePreset): [string, string] {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (preset === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  }
  if (preset === "last7") {
    start.setDate(today.getDate() - 6);
  }
  if (preset === "last30") {
    start.setDate(today.getDate() - 29);
  }
  if (preset === "thisMonth") {
    start.setDate(1);
    end.setMonth(today.getMonth() + 1, 0);
  }
  if (preset === "lastMonth") {
    start.setMonth(today.getMonth() - 1, 1);
    end.setMonth(today.getMonth(), 0);
  }

  return [toIsoDate(start), toIsoDate(end)];
}

function shiftDateRange(startDate: string, endDate: string, direction: -1 | 1): [string, string] {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  start.setDate(start.getDate() + rangeDays * direction);
  end.setDate(end.getDate() + rangeDays * direction);
  return [toIsoDate(start), toIsoDate(end)];
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return compactNumber.format(value);
}

function formatPercent(value: number) {
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${value.toFixed(1)}%`;
}

function exportCsv<T>(fileName: string, columns: TableColumn<T>[], rows: T[]) {
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCsv(column.csvValue ? column.csvValue(row) : String(column.value(row)))).join(","))
    .join("\n");
  downloadText(fileName, `${header}\n${body}`);
}

function exportCustomerCsv(rows: CustomerDebt[]) {
  const columns: TableColumn<CustomerDebt>[] = [
    { id: "client", label: "Client", value: (row) => row.client },
    { id: "total", label: "Total", value: (row) => row.total },
    { id: "oldDebt", label: "Old Debt", value: (row) => row.oldDebt },
    { id: "terminal", label: "Terminal", value: (row) => row.terminal },
    { id: "transfer", label: "Transfer", value: (row) => row.transfer },
    { id: "cash", label: "Cash", value: (row) => row.cash },
    { id: "riyal", label: "Riyal", value: (row) => row.riyal },
  ];
  exportCsv("customer-ledger.csv", columns, rows);
}

function escapeCsv(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function createCustomerRows(count: number): CustomerDebt[] {
  const names = [
    "ZAYTUN (BOBOEV ABDUVALI ABDURAXMONOVICH MCHJ)",
    "SELMAK MAFTUNA",
    "MURODOV SHERZOD OLIMOVICH (BREND PAKET)",
    "AKMAL 84 (XAYDAROV AKMAL ASROROVICH YATT)",
    "NADIRABEGIM MARKET",
    "INAYATOVA NIGORA YTT",
    "OTABEK OZIQ OVQAT",
    "IXLOS FARM MCHJ",
    "MED FARM VELLNES",
    "DUKON YTT 090",
    "SAXOVAT MARKET",
    "YANGI FARM PLUS",
    "NURAFSHON SAVDO",
    "ALFA TRADE GROUP",
  ];

  return Array.from({ length: count }, (_, index) => {
    const base = (index % 23) * 137_900 + (index % 7) * 418_000;
    const sign = index % 11 === 0 ? 1 : -1;
    const total = sign * (base + (index % 5) * 1_750_000);
    const terminal = index % 3 === 0 ? Math.round(total * 0.18) : 0;
    const transfer = index % 4 === 0 ? Math.round(total * 0.22) : 0;
    const cash = Math.round(total - terminal - transfer);
    return {
      id: index + 1,
      client: `${names[index % names.length]} ${index > names.length ? index + 1 : ""}`.trim(),
      total,
      oldDebt: Math.round(total * 0.72),
      terminal,
      transfer,
      cash,
      riyal: index % 19 === 0 ? Math.round(total / 12) : 0,
    };
  });
}

export default App;