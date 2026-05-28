import {
  LayoutDashboard,
  FileText,
  Users,
  FileBarChart,
  Wallet,
  Warehouse,
  Truck,
  Target,
  BarChart2,
  PieChart,
  UserCog,
  ShieldCheck,
  Lock,
  Settings,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборды', path: '/' },
  { icon: FileText, label: 'Заявки', path: '/orders' },
  { icon: Users, label: 'Клиенты', path: '/clients/clients', active: true, 
    submenu: [
      { label: 'Клиенты', path: '/clients/clients', active: true },
      { label: 'Клиенты на карте', path: '/clients/customer-maps' },
      { label: 'QR коды клиентов', path: '/clients/qr-codes' },
      { label: 'Объединение клиентов', path: '/clients/duplication' },
      { label: 'Оборудование', path: '/clients/equipments' },
      { label: 'Остатки в торговых точках', path: '/clients/bonuses-retail-outlets' },
      { label: 'Отчет по таре', path: '/clients/container-reports' },
    ]
  },
  { icon: FileBarChart, label: 'Накладные', path: '/invoices' },
  { icon: Wallet, label: 'Касса', path: '/cash' },
  { icon: Warehouse, label: 'Склад', path: '/warehouse' },
  { icon: Truck, label: 'Поставщики', path: '/suppliers' },
  { icon: Target, label: 'Планы', path: '/plans' },
  { icon: BarChart2, label: 'Отчёт', path: '/reports' },
  { icon: PieChart, label: 'Pivot отчеты', path: '/pivot' },
  { icon: UserCog, label: 'Пользователи', path: '/users' },
  { icon: ShieldCheck, label: 'Аудит', path: '/audit' },
  { icon: Lock, label: 'Доступ', path: '/access' },
  { icon: Settings, label: 'Настройки', path: '/settings' },
  { icon: MapPin, label: 'GPS', path: '/gps' },
];

export const Sidebar = () => {
  return (
    <div className="w-64 bg-[#013532] text-white flex flex-col h-screen fixed left-0 top-0 z-50 overflow-y-auto">
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 bg-white rounded-sm" />
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {menuItems.map((item) => (
          <div key={item.label}>
            <button
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10",
                item.active && "bg-emerald-600 hover:bg-emerald-500"
              )}
            >
              <item.icon className="w-5 h-5 opacity-80" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.submenu && <ChevronRight className="w-4 h-4 opacity-50 rotate-90" />}
            </button>
            
            {item.submenu && (
              <div className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-4">
                {item.submenu.map((sub) => (
                  <button
                    key={sub.label}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs rounded transition-colors hover:text-emerald-400",
                      sub.active ? "text-emerald-400 font-semibold" : "text-white/60"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
};
