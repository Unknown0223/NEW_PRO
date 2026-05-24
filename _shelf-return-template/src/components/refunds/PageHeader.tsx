import { Icon } from "../Icon";

export default function PageHeader() {
  const today = new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
      <div>
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          <span className="flex items-center gap-1 hover:text-indigo-600 cursor-pointer">
            <Icon name="home" className="h-3.5 w-3.5" /> Главная
          </span>
          <span>/</span>
          <span className="hover:text-indigo-600 cursor-pointer">Заявки</span>
          <span>/</span>
          <span className="font-medium text-slate-700">Создать возврат с полки</span>
        </nav>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            Создать возврат с полки
          </h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
            Черновик
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Оформление возврата товаров, находящихся на торговой полке клиента
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <Icon name="calendar" className="h-4 w-4 text-indigo-500" />
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            Сегодня
          </div>
          <div className="text-sm font-semibold text-slate-900">{today}</div>
        </div>
      </div>
    </div>
  );
}
