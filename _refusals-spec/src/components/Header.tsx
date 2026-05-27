import { MapPin, Star, User } from 'lucide-react';

export default function Header() {
  return (
    <div className="flex items-center justify-between px-4 bg-white border-b border-gray-200 h-11 flex-shrink-0">
      {/* Left: GPS + Favorites */}
      <div className="flex items-center gap-3">
        <a
          href="#gps"
          className="flex items-center gap-1 text-gray-500 hover:text-teal-600 transition-colors"
        >
          <MapPin size={14} className="text-teal-500" />
          <span className="text-xs font-medium text-gray-600">GPS</span>
        </a>
        <span className="text-gray-200">|</span>
        <button className="flex items-center gap-1 text-gray-400 hover:text-teal-600 text-xs transition-colors">
          <Star size={12} />
          <span>Нет избранные страницы</span>
        </button>
      </div>

      {/* Right: User avatar */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden">
          <User size={15} className="text-gray-600" />
        </div>
      </div>
    </div>
  );
}
