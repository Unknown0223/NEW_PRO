import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileText,
  BarChart2,
  UserCheck,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  Truck,
  Warehouse,
  ClipboardList,
  PieChart,
  Shield,
  Settings,
  Plus,
} from 'lucide-react';

interface ChildItem {
  label: string;
  path: string;
  isAction?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: ChildItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Дашборды',
    icon: <LayoutDashboard size={16} />,
    path: '/',
  },
  {
    id: 'orders',
    label: 'Заявки',
    icon: <ShoppingCart size={16} />,
    children: [
      { label: 'Создать заказ', path: '/orders/create', isAction: true },
      { label: 'Создать возврат с полки', path: '/orders/return-shelf', isAction: true },
      { label: 'Создать возврат с полки по заказу', path: '/orders/return-shelf-by-order', isAction: true },
      { label: 'Заявки', path: '/orders' },
      { label: 'Отказы', path: '/orders/refusals' },
      { label: 'Предложение для создания заказа', path: '/orders/suggestions' },
      { label: 'Автоматизация заявок', path: '/orders/automation' },
    ],
  },
  {
    id: 'clients',
    label: 'Клиенты',
    icon: <Users size={16} />,
    path: '/clients',
  },
  {
    id: 'invoices',
    label: 'Накладные',
    icon: <Receipt size={16} />,
    path: '/invoices',
  },
  {
    id: 'cash',
    label: 'Касса',
    icon: <FileText size={16} />,
    path: '/cash',
  },
  {
    id: 'warehouse',
    label: 'Склад',
    icon: <Warehouse size={16} />,
    path: '/warehouse',
  },
  {
    id: 'suppliers',
    label: 'Поставщики',
    icon: <Truck size={16} />,
    path: '/suppliers',
  },
  {
    id: 'plans',
    label: 'Планы',
    icon: <ClipboardList size={16} />,
    path: '/plans',
  },
  {
    id: 'reports',
    label: 'Отчёт',
    icon: <BarChart2 size={16} />,
    path: '/reports',
  },
  {
    id: 'pivot',
    label: 'Pivot отчеты',
    icon: <PieChart size={16} />,
    path: '/pivot',
  },
  {
    id: 'users',
    label: 'Пользователи',
    icon: <UserCheck size={16} />,
    path: '/users',
  },
  {
    id: 'audit',
    label: 'Аудит',
    icon: <Package size={16} />,
    path: '/audit',
  },
];

const bottomItems = [
  { id: 'access', label: 'Доступ', icon: <Shield size={16} />, path: '/access' },
  { id: 'settings', label: 'Настройки', icon: <Settings size={16} />, path: '/settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['orders']);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = (id: string) => {
    setExpandedMenus((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isChildActive = (children: ChildItem[]) =>
    children.some((c) => location.pathname === c.path);

  return (
    <div
      className={`flex flex-col h-screen bg-[#102030] text-white transition-all duration-300 ease-in-out flex-shrink-0 relative z-20 overflow-hidden ${
        collapsed ? 'w-[56px]' : 'w-[210px]'
      }`}
    >
      {/* Logo area */}
      <div
        className={`flex items-center h-12 border-b border-white/10 flex-shrink-0 ${
          collapsed ? 'justify-center px-2' : 'px-3 gap-2'
        }`}
      >
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-[#102030] font-extrabold text-xs">CRM</span>
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto text-white/40 hover:text-white/80 transition-colors p-1 rounded"
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute right-0 top-3 translate-x-full bg-[#102030] border border-l-0 border-white/20 rounded-r-lg px-1 py-2 text-white/60 hover:text-white"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1 scrollbar-thin">
        {menuItems.map((item) => {
          const childActive = item.children ? isChildActive(item.children) : false;
          const itemActive = !item.children && item.path ? isActive(item.path) : false;
          const isExpanded = expandedMenus.includes(item.id);

          return (
            <div key={item.id}>
              {/* Parent item */}
              <button
                onClick={() => {
                  if (item.children) {
                    if (collapsed) setCollapsed(false);
                    toggleMenu(item.id);
                  } else {
                    navigate(item.path!);
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center h-9 transition-colors group ${
                  collapsed ? 'justify-center px-0' : 'px-3 gap-2.5'
                } ${
                  itemActive || childActive
                    ? 'text-teal-300 bg-white/8'
                    : 'text-white/70 hover:text-white hover:bg-white/6'
                }`}
              >
                <span className="flex-shrink-0 w-4 flex items-center justify-center">
                  {item.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-[12px] leading-tight truncate">
                      {item.label}
                    </span>
                    {item.children && (
                      isExpanded ? (
                        <ChevronUp size={11} className="text-white/40 flex-shrink-0" />
                      ) : (
                        <ChevronDown size={11} className="text-white/40 flex-shrink-0" />
                      )
                    )}
                  </>
                )}
              </button>

              {/* Submenu */}
              {!collapsed && item.children && isExpanded && (
                <div className="bg-[#0b1a27]">
                  {item.id === 'orders' && (
                    <>
                      {/* Actions section */}
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                          действия
                        </span>
                      </div>
                      {item.children
                        .filter((c) => c.isAction)
                        .map((child) => (
                          <button
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            className={`w-full flex items-center gap-2 pl-5 pr-3 py-2 text-[11px] transition-colors hover:bg-white/8 ${
                              isActive(child.path)
                                ? 'text-teal-300'
                                : 'text-teal-400/80 hover:text-teal-300'
                            }`}
                          >
                            <span className="text-teal-400 flex-shrink-0">
                              <Plus size={10} />
                            </span>
                            <span className="truncate">{child.label}</span>
                          </button>
                        ))}

                      {/* Management section */}
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                          управление заказами
                        </span>
                      </div>
                      {item.children
                        .filter((c) => !c.isAction)
                        .map((child) => (
                          <button
                            key={child.path}
                            onClick={() => navigate(child.path)}
                            className={`w-full flex items-center gap-2 pl-5 pr-3 py-2 text-[11px] transition-colors hover:bg-white/8 truncate ${
                              isActive(child.path)
                                ? 'text-teal-300 bg-white/5 font-medium'
                                : 'text-white/60 hover:text-white/90'
                            }`}
                          >
                            <span
                              className={`w-1 h-1 rounded-full flex-shrink-0 ${
                                isActive(child.path) ? 'bg-teal-400' : 'bg-white/20'
                              }`}
                            />
                            <span className="truncate">{child.label}</span>
                          </button>
                        ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="border-t border-white/10 py-1 flex-shrink-0">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center h-9 text-white/60 hover:text-white hover:bg-white/6 transition-colors ${
              collapsed ? 'justify-center px-0' : 'px-3 gap-2.5'
            }`}
          >
            <span className="flex-shrink-0 w-4 flex items-center justify-center">
              {item.icon}
            </span>
            {!collapsed && <span className="text-[12px]">{item.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
