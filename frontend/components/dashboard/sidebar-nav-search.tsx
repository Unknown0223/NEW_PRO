"use client";

import type { NavSearchEntry } from "@/components/dashboard/nav-config";
import { ScrollEdgeHints } from "@/components/ui/scroll-edge-hints";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

const REPORTS_SETTINGS_HREF = "/reports/settings";

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").trim();
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = normalize(text).indexOf(query);
  if (!query || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-amber-300/30 px-0.5 text-inherit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

/**
 * Yon menyu: tepada qidiruv. Bo'sh bo'lsa — odatdagi bo'limlar daraxti (`children`),
 * yozilganda — barcha bo'limlardan mos bandlar bo'lim nomi bilan guruhlangan holda.
 * Bo'lim nomiga mos kelsa (masalan «Касса») — o'sha bo'limning hamma bandlari chiqadi.
 */
export function SidebarNavSearch({
  entries,
  isActive,
  onOpenReportsSettings,
  watch,
  children
}: {
  entries: NavSearchEntry[];
  isActive: (href: string) => boolean;
  onOpenReportsSettings: () => void;
  watch?: unknown;
  children: ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const q = normalize(query);

  const groups = useMemo(() => {
    if (!q) return [];
    const bySection = new Map<string, NavSearchEntry[]>();
    for (const e of entries) {
      if (!normalize(e.item.label).includes(q) && !normalize(e.section ?? "").includes(q)) continue;
      const key = e.section ?? "";
      const arr = bySection.get(key) ?? [];
      arr.push(e);
      bySection.set(key, arr);
    }
    return [...bySection.entries()].map(([section, items]) => ({ section, items }));
  }, [entries, q]);

  const firstResult = groups[0]?.items[0];

  function select(e: NavSearchEntry) {
    setQuery("");
    if (e.item.href === REPORTS_SETTINGS_HREF) onOpenReportsSettings();
    else router.push(e.item.href);
  }

  return (
    <>
      <div className="px-2 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/55" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Escape") setQuery("");
              if (ev.key === "Enter" && firstResult) {
                ev.preventDefault();
                select(firstResult);
              }
            }}
            placeholder="Поиск по меню…"
            aria-label="Поиск по меню"
            className="h-9 w-full rounded-lg border border-white/15 bg-white/10 pl-8 pr-8 text-[13px] text-white placeholder:text-white/50 focus:border-white/40 focus:bg-white/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Очистить поиск"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <ScrollEdgeHints watch={q ? groups : watch} contentClassName="scrollbar-none flex flex-col gap-0.5 p-2">
        {!q ? (
          children
        ) : groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-white/60">Ничего не найдено</p>
        ) : (
          groups.map((g) => (
            <div key={g.section || "_"} className="pb-2">
              {g.section ? (
                <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-foreground/55">
                  {g.section}
                </p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {g.items.map((e) => {
                  const active = isActive(e.item.href);
                  const cls = cn(
                    "block w-full rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  );
                  return (
                    <li key={e.item.href}>
                      {e.item.href === REPORTS_SETTINGS_HREF ? (
                        <button type="button" className={cls} onClick={() => select(e)}>
                          <Highlight text={e.item.label} query={q} />
                        </button>
                      ) : (
                        <Link href={e.item.href} className={cls} onClick={() => setQuery("")}>
                          <Highlight text={e.item.label} query={q} />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </ScrollEdgeHints>
    </>
  );
}
