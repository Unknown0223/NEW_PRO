import { IconGps, IconStar } from './Icons';

export function Topbar() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 sticky top-0 z-20">
      <div className="flex items-center gap-2 text-slate-700">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100">
          <IconGps className="w-4 h-4 text-[color:var(--brand)]" />
        </span>
        <span className="text-sm font-medium">GPS</span>
      </div>
      <div className="ml-6 flex items-center gap-2 text-slate-500 text-sm">
        <IconStar className="w-4 h-4" />
        <span>Нет избранные страницы</span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
        </button>
        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shadow">
          <div className="w-full h-full bg-gradient-to-br from-amber-200 via-orange-300 to-amber-500" />
        </div>
      </div>
    </header>
  );
}
