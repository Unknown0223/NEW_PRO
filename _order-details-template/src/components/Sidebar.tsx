import { 
  LayoutDashboard, 
  ShoppingCart, 
  Users, 
  FileText, 
  CreditCard, 
  Package, 
  Truck, 
  UsersRound, 
  BarChart3, 
  PieChart, 
  UserCog, 
  ShieldCheck, 
  Settings,
  ChevronRight
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Дашборды', hasSubmenu: true },
  { icon: ShoppingCart, label: 'Заявки', hasSubmenu: true },
  { icon: Users, label: 'Клиенты', hasSubmenu: true },
  { icon: FileText, label: 'Накладные', hasSubmenu: true },
  { icon: CreditCard, label: 'Касса', hasSubmenu: true },
  { icon: Package, label: 'Склад', hasSubmenu: true },
  { icon: Truck, label: 'Поставщики', hasSubmenu: true },
  { icon: UsersRound, label: 'Планы', hasSubmenu: true },
  { icon: BarChart3, label: 'Отчёт', hasSubmenu: true },
  { icon: PieChart, label: 'Pivot отчеты', hasSubmenu: true },
  { icon: UserCog, label: 'Пользователи', hasSubmenu: true },
  { icon: ShieldCheck, label: 'Аудит', hasSubmenu: true },
];

const bottomMenuItems = [
  { icon: ShieldCheck, label: 'Доступ' },
  { icon: Settings, label: 'Настройки' },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-teal-900 via-teal-800 to-teal-900 text-white flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center border-b border-teal-700">
        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
          <div className="w-8 h-8 bg-teal-600 rounded-md"></div>
        </div>
      </div>

      {/* Main Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              <a
                href="#"
                className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 hover:bg-teal-700/50 ${
                  item.label === 'Заявки' ? 'bg-teal-700/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.hasSubmenu && <ChevronRight className="w-4 h-4 opacity-50" />}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Menu */}
      <div className="border-t border-teal-700 py-4">
        <ul className="space-y-1 px-2">
          {bottomMenuItems.map((item, index) => (
            <li key={index}>
              <a
                href="#"
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-teal-700/50"
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
