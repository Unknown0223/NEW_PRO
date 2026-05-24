import { Icon } from "./Icon";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <button className="lg:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100">
          <Icon name="grid" />
        </button>
        <div className="relative hidden md:block">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            placeholder="Поиск клиентов, заказов, накладных..."
            className="w-80 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="hidden sm:flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          <span className="text-xs">RU</span>
          <Icon name="chevron-down" className="h-3.5 w-3.5" />
        </button>
        <button className="relative rounded-md p-2 text-slate-600 hover:bg-slate-100">
          <Icon name="bell" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="mx-1 h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-semibold text-white">
            ЖК
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-slate-900 leading-tight">
              Жасур А.
            </div>
            <div className="text-[11px] text-slate-500 leading-tight">
              Агент #01
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
