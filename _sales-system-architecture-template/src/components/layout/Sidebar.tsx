import { useState } from 'react';
import {
  IconDashboard, IconCart, IconClients, IconInvoice, IconCash,
  IconWarehouse, IconSupplier, IconPlan, IconReport, IconPivot,
  IconUsers, IconChevron, IconChevronLeft,
} from './Icons';

export type RouteId =
  | 'dashboard'
  | 'orders.create'
  | 'orders.return-shelf'
  | 'orders.return-shelf-order'
  | 'orders.list'
  | 'orders.refused'
  | 'orders.offer'
  | 'orders.automation'
  | 'clients'
  | 'invoices'
  | 'cash'
  | 'warehouse'
  | 'suppliers'
  | 'plans'
  | 'reports'
  | 'pivot'
  | 'users';

type Item = {
  id: string;
  label: string;
  icon: any;
  route?: RouteId;
  children?: { id: RouteId; label: string; section?: string }[];
};

const items: Item[] = [
  { id: 'dash', label: 'Дашборды', icon: IconDashboard, route: 'dashboard' },
  {
    id: 'orders', label: 'Заявки', icon: IconCart,
    children: [
      { id: 'orders.create', label: 'Создать заказ', section: 'ДЕЙСТВИЯ' },
      { id: 'orders.return-shelf', label: 'Создать возврат с полки' },
      { id: 'orders.return-shelf-order', label: 'Создать возврат с полки по заказа' },
      { id: 'orders.list', label: 'Заявки', section: 'УПРАВЛЕНИЕ ЗАКАЗАМИ' },
      { id: 'orders.refused', label: 'Отказы' },
      { id: 'orders.offer', label: 'Предложение для создания заказа' },
      { id: 'orders.automation', label: 'Автоматизация заявок' },
    ],
  },
  { id: 'cli', label: 'Клиенты', icon: IconClients, route: 'clients' },
  { id: 'inv', label: 'Накладные', icon: IconInvoice, route: 'invoices' },
  { id: 'cash', label: 'Касса', icon: IconCash, route: 'cash' },
  { id: 'wh', label: 'Склад', icon: IconWarehouse, route: 'warehouse' },
  { id: 'sup', label: 'Поставщики', icon: IconSupplier, route: 'suppliers' },
  { id: 'pln', label: 'Планы', icon: IconPlan, route: 'plans' },
  { id: 'rep', label: 'Отчёт', icon: IconReport, route: 'reports' },
  { id: 'piv', label: 'Pivot отчёты', icon: IconPivot, route: 'pivot' },
  { id: 'usr', label: 'Пользователи', icon: IconUsers, route: 'users' },
];

interface Props {
  current: RouteId;
  onNavigate: (r: RouteId) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ current, onNavigate, collapsed, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['orders']));

  const toggleGroup = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const isChildActive = (it: Item) =>
    it.children?.some((c) => c.id === current);

  return (
    <aside
      className="relative shrink-0 transition-all duration-300 ease-out"
      style={{
        width: collapsed ? 72 : 240,
        background: '#0c2733',
        color: 'white',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-white/5">
        <div className="w-10 h-10 rounded bg-white/95 flex items-center justify-center">
          <div className="w-5 h-5 rounded-sm bg-[color:var(--brand)]" />
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center text-slate-600 hover:text-[color:var(--brand)] z-10"
        title="Свернуть"
      >
        <IconChevronLeft className={`w-3.5 h-3.5 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
      </button>

      <nav className="py-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.route === current || isChildActive(it);
          const isOpen = expanded.has(it.id) && !collapsed;

          return (
            <div key={it.id}>
              <div
                className={`side-item ${active ? 'active' : ''}`}
                onClick={() => {
                  if (it.children) toggleGroup(it.id);
                  else if (it.route) onNavigate(it.route);
                }}
                title={collapsed ? it.label : ''}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.children && (
                      <IconChevron
                        className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      />
                    )}
                  </>
                )}
              </div>
              {isOpen && it.children && (
                <div className="bg-[#0a1f29] py-1">
                  {it.children.map((c, idx) => (
                    <div key={c.id}>
                      {c.section && (
                        <div className="text-[11px] uppercase text-white/30 px-5 pt-3 pb-1 tracking-wider">
                          {c.section}
                        </div>
                      )}
                      <div
                        className={`side-sub flex items-center gap-2 ${current === c.id ? 'active' : ''}`}
                        onClick={() => onNavigate(c.id)}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${current === c.id ? 'bg-[color:var(--brand)]' : 'bg-white/30'}`} />
                        {c.label}
                      </div>
                      {idx === it.children!.length - 1 && <div className="h-1" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
