import { Calendar, User } from 'lucide-react';

export const Header = () => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-2">
           Нет избранные страницы
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex flex-col text-[10px] leading-tight text-gray-500">
            <span>Дата</span>
            <span className="font-semibold text-gray-700">01.01.2023 - 27.05.2026</span>
          </div>
          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
             &lt; 
          </button>
          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
             &gt; 
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            <User className="w-5 h-5 text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
};
