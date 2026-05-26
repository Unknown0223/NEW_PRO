import { MapPin } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <MapPin size={14} />
          <span>GPS</span>
        </button>
        <span className="text-sm text-gray-600">Нет избранные страницы</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 overflow-hidden rounded-full bg-gray-200 ring-2 ring-gray-100">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
            alt="User"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
