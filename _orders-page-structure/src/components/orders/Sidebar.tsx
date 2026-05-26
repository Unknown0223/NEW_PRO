import React, { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Users,
  Wallet,
  Package,
  Truck,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  children?: { label: string; href?: string; active?: boolean }[];
}

const menuItems: MenuItem[] = [
  { icon: <LayoutDashboard className="w-5 h-5" />, label: 'Дашборды' },
  {
    icon: <ClipboardList className="w-5 h-5" />,
    label: 'Заявки',
    active: true,
    children: [
      { label: 'Создать заказ', href: '/orders/create' },
      { label: 'Создать возврат с полки', href: '/orders/return/create' },
      { label: 'Создать возврат с полки по заказ', href: '/orders/return-by-order/create' },
    ],
  },
  {
    icon: <FileText className="w-5 h-5" />,
    label: 'Управление заказами',
    children: [
      { label: 'Заявки', active: true },
      { label: 'Отказы' },
      { label: 'Предложение для создания заказа' },
      { label: 'Автоматизация заявок' },
    ],
  },
  { icon: <Users className="w-5 h-5" />, label: 'Клиенты' },
  { icon: <FileText className="w-5 h-5" />, label: 'Накладные' },
  { icon: <Wallet className="w-5 h-5" />, label: 'Касса' },
  { icon: <Package className="w-5 h-5" />, label: 'Склад' },
  { icon: <Truck className="w-5 h-5" />, label: 'Поставщики' },
  { icon: <BarChart3 className="w-5 h-5" />, label: 'Планы' },
  { icon: <PieChart className="w-5 h-5" />, label: 'Отчёт' },
  { icon: <PieChart className="w-5 h-5" />, label: 'Pivot отчеты' },
  { icon: <Users className="w-5 h-5" />, label: 'Пользователи' },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['Заявки', 'Управление заказами']));

  const toggleExpand = (label: string) => {
    const next = new Set(expandedItems);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    setExpandedItems(next);
  };

  return (
    <aside
      className={`flex flex-col h-screen bg-[#0d3b3b] text-white transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/10">
        {!collapsed && <div className="w-8 h-8 bg-white/20 rounded-lg" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item) => (
          <div key={item.label}>
            <button
              onClick={() => item.children && toggleExpand(item.label)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                item.active
                  ? 'bg-white/10 text-white'
                  : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.children && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedItems.has(item.label) ? '' : '-rotate-90'
                      }`}
                    />
                  )}
                </>
              )}
            </button>
            {!collapsed && item.children && expandedItems.has(item.label) && (
              <div className="bg-black/20">
                {item.children.map((child) => (
                  <button
                    key={child.label}
                    className={`w-full text-left pl-12 pr-4 py-2 text-sm transition-colors ${
                      child.active
                        ? 'text-teal-300 bg-white/5'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-xs font-bold">
            AD
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Admin User</p>
              <p className="text-xs text-gray-400 truncate">admin@crm.uz</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
