"use client";

import { useEffect, useRef } from "react";
import {
  stylesByFamily,
  WDR_DEFAULT_TABLE_STYLE_ID,
  type PivotTableStyleFamily
} from "@/lib/pivot-table-styles";
import { PORTABLE_PIVOT_THEMES } from "@/lib/pivot-portable-themes";
import { TableStyleThumbnailFromDef } from "./TableStyleThumbnail";

const SECTIONS: { family: PivotTableStyleFamily; title: string }[] = [
  { family: "light", title: "Светлые" },
  { family: "medium", title: "Средние" },
  { family: "dark", title: "Тёмные" }
];

type Props = {
  open: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  onCreateStub: () => void;
  onClose: () => void;
  className?: string;
};

/** Excel-like dark table-style gallery popover (+ portable PIVOT_THEMES). */
export function TableStyleGallery({
  open,
  selectedId,
  onSelect,
  onClear,
  onCreateStub,
  onClose,
  className
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const root = panelRef.current?.parentElement;
      if (root && root.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Стили таблицы"
      className={`absolute left-0 top-full z-40 mt-1 w-[320px] overflow-hidden rounded-sm border border-[#555] bg-[#2b2b2b] text-[#f0f0f0] shadow-xl ${className ?? ""}`}
    >
      <div className="max-h-[min(420px,70vh)] overflow-y-auto px-3 pb-2 pt-2.5">
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-normal text-[#d0d0d0]">Portable (@salec/pivot-ui)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PORTABLE_PIVOT_THEMES.map((theme) => {
              const selected = selectedId === theme.id;
              const bg = theme.cssVars["--pg-header-bg"] ?? "#f4f4f5";
              const accent = theme.cssVars["--pivot-accent"] ?? "#2563eb";
              return (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.label}
                  onClick={() => {
                    onSelect(theme.id);
                    onClose();
                  }}
                  className={`rounded-sm border px-2 py-2 text-left text-[11px] ${
                    selected ? "border-[#8ab4f8] bg-[#3d3d3d]" : "border-[#555] hover:bg-[#3d3d3d]"
                  }`}
                >
                  <span
                    className="mb-1 block h-3 w-full rounded-sm"
                    style={{ background: `linear-gradient(90deg, ${bg}, ${accent})` }}
                  />
                  {theme.label}
                </button>
              );
            })}
          </div>
        </div>
        {SECTIONS.map((section) => {
          const items = stylesByFamily(section.family);
          return (
            <div key={section.family} className="mb-3 last:mb-1">
              <p className="mb-1.5 text-[11px] font-normal text-[#d0d0d0]">{section.title}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {items.map((style) => (
                  <TableStyleThumbnailFromDef
                    key={style.id}
                    style={style}
                    selected={selectedId === style.id}
                    onClick={() => {
                      onSelect(style.id);
                      onClose();
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#555] px-1 py-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-[#f0f0f0] hover:bg-[#3d3d3d]"
          onClick={() => {
            onCreateStub();
            onClose();
          }}
        >
          <CreateStyleIcon />
          Создать стиль таблицы...
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[12px] text-[#f0f0f0] hover:bg-[#3d3d3d]"
          onClick={() => {
            onClear();
            onClose();
          }}
        >
          <ClearStyleIcon />
          Очистить
          {selectedId === WDR_DEFAULT_TABLE_STYLE_ID ? (
            <span className="ml-auto text-[10px] text-[#888]">по умолч.</span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

function CreateStyleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="1" y="1" width="12" height="12" rx="1" fill="none" stroke="currentColor" />
      <path d="M7 3.5v7M3.5 7h7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ClearStyleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M3 3.5h8M5 3.5V2.5h4v1M4.5 5v6h5V5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function TableStyleToolbarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="1" y="1" width="5" height="5" fill="#5b9bd5" />
      <rect x="8" y="1" width="5" height="5" fill="#70ad47" />
      <rect x="1" y="8" width="5" height="5" fill="#ed7d31" />
      <rect x="8" y="8" width="5" height="5" fill="#7030a0" />
    </svg>
  );
}
