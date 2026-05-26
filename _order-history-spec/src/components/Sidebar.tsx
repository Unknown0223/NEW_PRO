import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  FileText,
  Wallet,
  Warehouse,
  Truck,
  BarChart3,
  PieChart,
  UserCog,
  ClipboardList,
  Lock,
  Settings,
  ChevronRight,
  Package,
} from 'lucide-react';
import { cn } from '../utils/cn';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  hasSub?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Дашборды', icon: <LayoutDashboard size={16} />, hasSub: true },
  { label: 'Заявки', icon: <ShoppingCart size={16} />, hasSub: true, active: true },
  { label: 'Клиенты', icon: <Users size={16} />, hasSub: true },
  { label: 'Накладные', icon: <FileText size={16} />, hasSub: true },
  { label: 'Касса', icon: <Wallet size={16} />, hasSub: true },
  { label: 'Склад', icon: <Warehouse size={16} />, hasSub: true },
  { label: 'Поставщики', icon: <Truck size={16} />, hasSub: true },
  { label: 'Планы', icon: <BarChart3 size={16} />, hasSub: true },
  { label: 'Отчёт', icon: <PieChart size={16} />, hasSub: true },
  { label: 'Pivot отчеты', icon: <BarChart3 size={16} />, hasSub: true },
  { label: 'Пользователи', icon: <UserCog size={16} />, hasSub: true },
  { label: 'Аудит', icon: <ClipboardList size={16} />, hasSub: true },
  { label: 'Доступ', icon: <Lock size={16} />, hasSub: true },
  { label: 'Настройки', icon: <Settings size={16} />, hasSub: true },
];

export default function Sidebar() {
  return (
    <aside className="flex w-60 flex-col bg-[#0b2e2f] text-white">
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-white/10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
          <Package size={18} className="text-[#0b2e2f]" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => (
          <a
            key={item.label}
            href="#"
            className={cn(
              'group flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-white/5',
              item.active && 'bg-white/10 text-teal-300'
            )}
          >
            <span
              className={cn(
                'flex-shrink-0 text-white/70',
                item.active && 'text-teal-300'
              )}
            >
              {item.icon}
            </span>
            <span className="flex-1 text-[13px]">{item.label}</span>
            {item.hasSub && (
              <ChevronRight size={14} className="text-white/30" />
            )}
          </a>
        ))}
      </nav>
    </aside>
  );
}
