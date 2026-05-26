import { useState } from 'react';

interface MenuItem {
  label: string;
  icon: string;
  hasChildren?: boolean;
  active?: boolean;
  children?: { label: string; active?: boolean }[];
}

const menuItems: MenuItem[] = [
  { label: 'Дашборды', icon: '📊', hasChildren: true },
  {
    label: 'Заявки',
    icon: '🛒',
    hasChildren: true,
    active: true,
    children: [
      { label: 'Создать заказ' },
      { label: 'Создать возврат с полки' },
      { label: 'Создать возврат с полки по заказ' },
      { label: 'Создать обмен' },
    ],
  },
  { label: 'Отказы', icon: '❌' },
  { label: 'Клиенты', icon: '👥', hasChildren: true },
  { label: 'Накладные', icon: '📋', hasChildren: true },
  { label: 'Касса', icon: '💵', hasChildren: true },
  { label: 'Склад', icon: '🏭', hasChildren: true },
  { label: 'Поставщики', icon: '🚚', hasChildren: true },
  { label: 'Планы', icon: '📝', hasChildren: true },
  { label: 'Отчёт', icon: '📈', hasChildren: true },
  { label: 'Pivot отчеты', icon: '📉' },
  { label: 'Пользователи', icon: '👤' },
  { label: 'Аудит', icon: '🔍', hasChildren: true },
  { label: 'Доступ', icon: '🔐' },
  { label: 'Настройки', icon: '⚙️' },
];

export default function Sidebar() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(['Заявки']));

  const toggle = (label: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-[#0f3d3e] text-white min-h-screen shrink-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
          <span className="text-[#0f3d3e] font-bold text-lg">O</span>
        </div>
        <div>
          <div className="font-semibold text-sm">OrderSys</div>
          <div className="text-[11px] text-white/60">CRM v2.4</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {menuItems.map((item) => {
          const isOpen = openItems.has(item.label);
          return (
            <div key={item.label}>
              <button
                onClick={() => item.hasChildren && toggle(item.label)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-white/5 transition-colors ${
                  item.active ? 'bg-white/10 text-white' : 'text-white/80'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.hasChildren && (
                  <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
              {isOpen && item.children && (
                <div className="bg-black/20">
                  <div className="px-5 py-2 text-[10px] uppercase tracking-wider text-white/40 font-medium">
                    действия
                  </div>
                  {item.children.map((child) => (
                    <a
                      key={child.label}
                      href="#"
                      className="block px-5 py-2 pl-14 text-sm text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <span className="text-teal-300 mr-2">•</span>
                      {child.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-sm font-semibold">
            АД
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Admin User</div>
            <div className="text-[11px] text-white/50 truncate">admin@orders.uz</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
