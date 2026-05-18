"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import type { ClientRow } from "@/lib/client-types";
import { orderClientPickerDisplayName } from "@/lib/order-picker-labels";
import { fieldClass } from "./constants";

type PolkiClientSearchSelectProps = {
  tenantSlug: string | null;
  value: string;
  onValueChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  selectedLabel: string | null;
  /** Berilganda: server `client_ids` bilan cheklanadi (500 tagacha). */
  eligibleClientIds?: number[];
  "data-testid"?: string;
  id?: string;
};

/** Zakaz / polki: klient qidiruvi (server, sahifalash; `client_ids` — linkage doirasi, 500 gacha). */
export function PolkiClientSearchSelect({
  tenantSlug,
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  selectedLabel,
  eligibleClientIds,
  "data-testid": testId,
  id: inputId
}: PolkiClientSearchSelectProps) {
  /** API `GET /clients` oddiy rejimda maks. 100 qator/sahifa (map rejimidan tashqari). */
  const LIST_LIMIT = 100;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 320 });

  const eligibleScopeKey = useMemo(() => {
    if (eligibleClientIds == null) return "";
    if (eligibleClientIds.length === 0) return "__empty_scope__";
    return [...eligibleClientIds].sort((a, b) => a - b).join(",");
  }, [eligibleClientIds]);

  const scopeBlocksServer = eligibleClientIds != null && eligibleClientIds.length === 0;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(draftSearch), 150);
    return () => clearTimeout(t);
  }, [draftSearch]);

  useEffect(() => {
    if (!open) {
      setDraftSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  const pickerQ = useInfiniteQuery({
    queryKey: [
      "clients",
      tenantSlug,
      "order-form-client-search-paged",
      eligibleScopeKey,
      debouncedSearch.trim()
    ],
    enabled: Boolean(tenantSlug) && open && !scopeBlocksServer,
    staleTime: STALE.list,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const sp = new URLSearchParams({
        page: String(pageParam),
        limit: String(LIST_LIMIT),
        is_active: "true"
      });
      const q = debouncedSearch.trim();
      if (q) sp.set("search", q);
      if (eligibleClientIds != null && eligibleClientIds.length > 0) {
        sp.set("client_ids", eligibleClientIds.slice(0, 500).join(","));
      }
      const { data } = await api.get<{ data: ClientRow[]; total: number; page: number; limit: number }>(
        `/api/${tenantSlug}/clients?${sp.toString()}`
      );
      const rows = data.data ?? [];
      return {
        rows,
        total: typeof data.total === "number" ? data.total : rows.length,
        page: typeof data.page === "number" ? data.page : pageParam,
        limit: typeof data.limit === "number" ? data.limit : LIST_LIMIT
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage == null || !Array.isArray(lastPage.rows)) return undefined;
      const loaded = allPages
        .filter((p): p is { rows: ClientRow[]; total: number; page: number; limit: number } =>
          p != null && Array.isArray(p.rows)
        )
        .reduce((acc, p) => acc + p.rows.length, 0);
      const lastLen = lastPage.rows.length;
      const total = typeof lastPage.total === "number" && Number.isFinite(lastPage.total) ? lastPage.total : loaded;
      if (lastLen === 0 || loaded >= total) return undefined;
      const page = typeof lastPage.page === "number" ? lastPage.page : allPages.length;
      return page + 1;
    }
  });

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const w = Math.min(Math.max(r.width, 280), vw - 16);
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    setCoords({ top: r.bottom + 6, left, width: w });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null;
    if (ro && triggerRef.current) ro.observe(triggerRef.current);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (triggerRef.current?.contains(node)) return;
      if (popRef.current?.contains(node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows =
    pickerQ.data?.pages?.flatMap((p) => (Array.isArray(p?.rows) ? p.rows : [])) ?? [];
  const firstPage = pickerQ.data?.pages?.find((p) => p != null && Array.isArray(p.rows));
  const totalReported =
    firstPage != null && typeof firstPage.total === "number" ? firstPage.total : rows.length;
  const valueNum = value.trim() ? Number.parseInt(value.trim(), 10) : NaN;
  const showPlaceholder = !value.trim() || !selectedLabel;
  const isLoadingRows = open && !scopeBlocksServer && pickerQ.isLoading;

  const popover = (
    <div
      ref={popRef}
      id={listId}
      role="listbox"
      aria-label="Клиенты"
      className="fixed z-[500] flex max-h-[min(55vh,400px)] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="relative shrink-0 border-b border-border/60 px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={searchInputRef}
          className="h-9 border-input bg-background pl-9 text-sm shadow-none"
          placeholder="ID, kod, ism, telefon, ИНН…"
          value={draftSearch}
          onChange={(e) => setDraftSearch(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Поиск клиента"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {scopeBlocksServer ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Kontekst yuklanmoqda…</p>
        ) : isLoadingRows ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {debouncedSearch.trim() ? "Ничего не найдено" : "Нет клиентов"}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border/60">
              {rows.map((c) => {
                const selected = Number.isFinite(valueNum) && c.id === valueNum;
                return (
                  <li key={c.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                        selected && "bg-primary/[0.06]"
                      )}
                      onClick={() => {
                        onValueChange(String(c.id));
                        setOpen(false);
                      }}
                    >
                      {selected ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <span className="mt-0.5 size-4 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1 truncate leading-snug">
                        {orderClientPickerDisplayName(c)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {pickerQ.hasNextPage ? (
              <div className="border-t border-border/40 px-2 py-2">
                <button
                  type="button"
                  className="w-full rounded-md border border-border/80 bg-muted/25 px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/45 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pickerQ.isFetchingNextPage}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void pickerQ.fetchNextPage()}
                >
                  {pickerQ.isFetchingNextPage ? "Yuklanmoqda…" : "Yana yuklash (keyingi sahifa)"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <div className="shrink-0 border-t border-border/60 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
        Yuklangan: <span className="font-medium tabular-nums text-foreground/80">{rows.length}</span>
        {totalReported > rows.length ? (
          <>
            {" "}
            / jami <span className="font-medium tabular-nums text-foreground/80">{totalReported}</span>
          </>
        ) : null}
        {debouncedSearch.trim() ? " · qidiruv" : ""} · {LIST_LIMIT} qator/sahifa
      </div>
    </div>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        data-testid={testId}
        disabled={disabled}
        className={cn(
          fieldClass,
          "flex items-center justify-between gap-2 text-left",
          !disabled && "cursor-pointer hover:bg-muted/30"
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((v) => !v)}
      >
        <span className={cn("min-w-0 flex-1 truncate", showPlaceholder && "text-muted-foreground")}>
          {showPlaceholder ? (placeholder ?? "Выберите клиента") : selectedLabel}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {mounted && open && tenantSlug ? createPortal(popover, document.body) : null}
    </div>
  );
}
