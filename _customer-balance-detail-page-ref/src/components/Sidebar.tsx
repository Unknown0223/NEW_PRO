import {
  LayoutGrid, ClipboardList, Users, FileText, Wallet, Warehouse, Truck,
  CalendarRange, BarChart3, PieChart, UserCog, ShieldCheck, KeyRound,
  Settings, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { cn } from '../utils/cn';

const menu = [
  { icon: LayoutGrid, label: 'Дашборды' },
  { icon: ClipboardList, label: 'Заявки' },
  { icon: Users, label: 'Клиенты' },
  { icon: FileText, label: 'Накладные' },
  { icon: Wallet, label: 'Касса', active: true },
  { icon: Warehouse, label: 'Склад' },
  { icon: Truck, label: 'Поставщики' },
  { icon: CalendarRange, label: 'Планы' },
  { icon: BarChart3, label: 'Отчёт' },
  { icon: PieChart, label: 'Pivot отчеты' },
  { icon: UserCog, label: 'Пользователи' },
  { icon: ShieldCheck, label: 'Аудит' },
];

const bottom = [
  { icon: KeyRound, label: 'Доступ' },
  { icon: Settings, label: 'Настройки' },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[200px] shrink-0 flex-col bg-[#113B3B] text-teal-100/80 min-h-screen sticky top-0 h-screen">
      <div className="relative flex items-center justify-center h-[84px]">
        <div className="w-12 h-12 rounded-xl bg-white shadow-sm" />
        <button className="absolute -right-2.5 top-8 w-5 h-9 rounded bg-[#1c4d4d] border border-teal-800 flex items-center justify-center text-teal-200 hover:bg-[#256060]">
          <ChevronLeft size={12} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 pt-2 space-y-0.5">
        {menu.map((m) => (
          <button
            key={m.label}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 h-[38px] rounded-lg text-[13px] transition-colors group',
              m.active
                ? 'bg-[#1aa096]/20 text-white font-medium'
                : 'hover:bg-white/5 hover:text-white'
            )}
          >
            <span className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              m.active ? 'bg-[#1aa096] text-white' : 'bg-white/10 text-teal-100/80 group-hover:bg-white/15'
            )}>
              <m.icon size={13} />
            </span>
            <span className="flex-1 text-left truncate">{m.label}</span>
            <ChevronRight size={13} className="opacity-40" />
          </button>
        ))}
        <div className="!my-3 border-t border-white/10" />
        {bottom.map((m) => (
          <button
            key={m.label}
            className="w-full flex items-center gap-2.5 px-2.5 h-[38px] rounded-lg text-[13px] hover:bg-white/5 hover:text-white transition-colors group"
          >
            <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center group-hover:bg-white/15">
              <m.icon size={13} />
            </span>
            <span className="flex-1 text-left truncate">{m.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-3 text-[10px] text-teal-100/40">ERP v4.2.1 · Build 20260630</div>
    </aside>
  );
}
