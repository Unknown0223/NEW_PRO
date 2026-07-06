"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";

import { BonusRuleProductCategoryTree } from "@/components/bonus-rules/bonus-rule-product-category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatGroupedInteger } from "@/lib/format-numbers";

type Props = {
  tenantSlug: string;
  label?: string;
  selected: Set<number>;
  onSelectedChange: React.Dispatch<React.SetStateAction<Set<number>>>;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
};

export function KpiProductCategoryTreeSelect({
  tenantSlug,
  label = "Продукт",
  selected,
  onSelectedChange,
  searchPlaceholder = "Поиск SKU / название",
  disabled = false,
  className
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 360 });

  const productIds = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const w = Math.min(Math.max(r.width, 360), vw - 16);
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);

    const gap = 6;
    const popHeight = popRef.current?.offsetHeight ?? 420;
    let top = r.bottom + gap;
    if (top + popHeight > vh - 8) {
      const above = r.top - gap - popHeight;
      top = above >= 8 ? above : Math.max(8, vh - popHeight - 8);
    }
    setCoords({ top, left, width: w });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(() => updatePosition());
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updatePosition()) : null;
    if (ro && triggerRef.current) ro.observe(triggerRef.current);
    if (ro && popRef.current) ro.observe(popRef.current);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

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

  const triggerSummary =
    selected.size === 0
      ? "Нажмите, чтобы выбрать"
      : `Выбрано: ${formatGroupedInteger(selected.size)}`;

  const popoverContent = (
    <div
      ref={popRef}
      id={listId}
      role="listbox"
      aria-multiselectable
      className="fixed z-[500] flex max-h-[min(60vh,480px)] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold tracking-tight">{label}</span>
        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-primary">
          {formatGroupedInteger(selected.size)} выбр.
        </span>
      </div>

      <div className="relative shrink-0 border-b border-border/60 px-3 py-2">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="h-9 border-input bg-background pl-9 text-sm shadow-none"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={searchPlaceholder}
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/15 px-3 py-2">
        <p className="text-[10px] text-muted-foreground">
          Kategoriya yoki alohida mahsulotni belgilang
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          disabled={selected.size === 0}
          onClick={() => onSelectedChange(new Set())}
        >
          Снять выбор
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2 py-2">
        <BonusRuleProductCategoryTree
          tenantSlug={tenantSlug}
          value={productIds}
          onChange={(ids) => onSelectedChange(new Set(ids))}
          search={search}
          querySuffix="kpi-pick"
          categoryCheckSelectsProducts
          defaultExpandAll={Boolean(search.trim())}
        />
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2 py-1.5 text-left text-xs shadow-sm outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          open && "ring-2 ring-ring ring-offset-2",
          disabled && "opacity-60"
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={cn("min-w-0 flex-1 truncate", selected.size === 0 && "text-muted-foreground")}>
          {triggerSummary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {mounted && open && !disabled ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}
