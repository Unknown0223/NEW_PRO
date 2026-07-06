import { MapPin, ChevronRight } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-4 sticky top-0 z-40">
      <button className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 text-[13px] text-gray-600 hover:bg-gray-50">
        <MapPin size={14} className="text-gray-400" />
        GPS
      </button>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[13px] text-gray-400">
        <span className="hover:text-gray-600 cursor-pointer">Касса</span>
        <ChevronRight size={13} />
        <span className="hover:text-gray-600 cursor-pointer">Баланс клиентов</span>
        <ChevronRight size={13} />
        <span className="text-gray-700 font-medium">KARZINKA</span>
      </nav>
      <div className="flex-1" />
      <span className="text-[13px] text-gray-500 hidden md:block">Нет избранные страницы</span>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center text-[12px] font-semibold ring-2 ring-teal-100 cursor-pointer">
        AS
      </div>
    </header>
  );
}
