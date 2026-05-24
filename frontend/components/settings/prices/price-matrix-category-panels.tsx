"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceMatrixTable } from "@/components/settings/prices/price-matrix-table";
import type { PriceMatrixRow } from "@/components/settings/prices/price-matrix-types";

export type CategoryPanelMeta = {
  id: number;
  label: string;
  rows: PriceMatrixRow[];
};

type Props = {
  panels: CategoryPanelMeta[];
  currency: string;
  draft: Record<number, string>;
  onDraftChange: (productId: number, value: string) => void;
  isLoading: boolean;
  needsFilters: boolean;
  needsCategories: boolean;
  disabled?: boolean;
};

export function PriceMatrixCategoryPanels({
  panels,
  currency,
  draft,
  onDraftChange,
  isLoading,
  needsFilters,
  needsCategories,
  disabled
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const panelIds = useMemo(() => panels.map((p) => String(p.id)), [panels]);

  useEffect(() => {
    if (panelIds.length === 0) {
      setActiveId(null);
      return;
    }
    if (activeId == null || !panelIds.includes(activeId)) {
      setActiveId(panelIds[0]!);
    }
  }, [panelIds, activeId]);

  if (needsFilters) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        Narx turini tanlang.
      </div>
    );
  }

  if (needsCategories) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        Chapdan kamida bitta kategoriya belgilang — har birining mahsulotlari alohida ko‘rinadi.
      </div>
    );
  }

  if (isLoading && panels.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Yuklanmoqda…
      </div>
    );
  }

  if (panels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        Tanlangan kategoriyalarda mahsulot yo‘q.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Tabs value={activeId} onValueChange={setActiveId} className="gap-3">
        <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
          {panels.map((p) => (
            <TabsTrigger
              key={p.id}
              value={String(p.id)}
              className="max-w-[11rem] truncate px-3 py-1.5 text-xs data-[state=active]:bg-card data-[state=active]:shadow-sm"
              title={p.label}
            >
              {p.label}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {p.rows.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {panels.map((p) => (
          <TabsContent key={p.id} value={String(p.id)} className="mt-0 focus-visible:outline-none">
            <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b bg-muted/25 px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{p.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {p.rows.length} ta mahsulot · {currency}
                  </p>
                </div>
              </div>

              <PriceMatrixTable
                rows={p.rows}
                currency={currency}
                draft={draft}
                onDraftChange={onDraftChange}
                isLoading={isLoading}
                needsFilters={false}
                needsCategories={false}
                showCategoryColumn={false}
                disabled={disabled}
              />
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
