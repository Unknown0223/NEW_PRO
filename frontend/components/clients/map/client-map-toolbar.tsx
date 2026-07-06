"use client";

import { Layers, MapPin } from "lucide-react";

export function ClientMapSearchToolbar({
  searchQuery,
  onSearchChange,
  onFind
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onFind: () => void;
}) {
  return (
    <div className="absolute left-4 top-4 z-[1000] flex items-center gap-0">
      <div className="flex overflow-hidden rounded-md border border-border bg-card shadow-md">
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onFind();
          }}
          placeholder="Адрес или объект"
          className="w-56 border-0 bg-card px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:ring-0 sm:w-72"
        />
        <button
          type="button"
          onClick={onFind}
          className="border-l border-border bg-yellow-400 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-yellow-500"
        >
          Найти
        </button>
      </div>
    </div>
  );
}

export function ClientMapBottomLinks() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-3 text-xs">
      <a
        href="https://yandex.ru/maps"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 font-medium text-slate-700 transition hover:text-teal-700"
      >
        <MapPin size={12} />
        <span className="underline">Открыть в Яндекс Картах</span>
      </a>
      <a
        href="https://tech.yandex.ru/maps/mapsapi/?from=api-maps"
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-700 transition hover:text-teal-700"
      >
        <span className="underline">Создать свою карту</span>
      </a>
    </div>
  );
}

export function ClientMapZoomControls({
  onZoomIn,
  onZoomOut,
  onReset
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="absolute left-3 top-16 z-[1000] flex flex-col gap-1">
      <button
        type="button"
        onClick={onZoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-lg font-light text-slate-700 shadow-md hover:bg-muted"
        title="Приблизить"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-lg font-light text-slate-700 shadow-md hover:bg-muted"
        title="Отдалить"
      >
        −
      </button>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-slate-500 shadow-md hover:bg-muted"
        title="Сбросить вид"
      >
        <Layers size={16} />
      </button>
    </div>
  );
}
