import type { ReactNode } from "react";

interface NavItem {
  label: string;
  icon: ReactNode;
  active?: boolean;
  divider?: boolean;
}

const icon = (path: ReactNode) => (
  <svg
    className="h-[18px] w-[18px]"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const items: NavItem[] = [
  { label: "Дашборды", icon: icon(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
  { label: "Заявки", icon: icon(<><path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M6 6L5 3H2" /></>) },
  { label: "Клиенты", icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>), active: true },
  { label: "Накладные", icon: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h6" /></>) },
  { label: "Касса", icon: icon(<><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="3" /></>) },
  { label: "Склад", icon: icon(<><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21V12h6v9" /></>) },
  { label: "Поставщики", icon: icon(<><path d="M12 3v13" /><path d="M5 10l7 6 7-6" /><path d="M4 21h16" /></>) },
  { label: "Планы", icon: icon(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>) },
  { label: "Отчёт", icon: icon(<><path d="M3 3v18h18" /><path d="M8 17V9M13 17V5M18 17v-7" /></>) },
  { label: "Pivot отчеты", icon: icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>) },
  { label: "Пользователи", icon: icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></>) },
  { label: "Аудит", icon: icon(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></>), divider: true },
  { label: "Доступ", icon: icon(<><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>) },
  { label: "Настройки", icon: icon(<><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" /><path d="M1 14h6M9 8h6M17 16h6" /></>) },
];

export default function Sidebar() {
  return (
    <aside className="relative hidden h-screen w-[250px] shrink-0 flex-col bg-[#0d3937] lg:flex">
      {/* logo placeholder */}
      <div className="flex items-center px-6 py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white" />
      </div>

      {/* collapse chevron */}
      <button
        className="absolute -right-3.5 top-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-md ring-1 ring-slate-200"
        aria-label="Свернуть меню"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {items.map((it) => (
          <div key={it.label}>
            <button
              className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                it.active
                  ? "bg-teal-400/15 font-medium text-white"
                  : "text-teal-100/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className={it.active ? "text-teal-300" : "text-teal-200/60 group-hover:text-teal-300"}>
                  {it.icon}
                </span>
                {it.label}
              </span>
              <svg className="h-3.5 w-3.5 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {it.divider && <div className="mx-3 my-3 h-px bg-teal-100/10" />}
          </div>
        ))}
      </nav>
    </aside>
  );
}
