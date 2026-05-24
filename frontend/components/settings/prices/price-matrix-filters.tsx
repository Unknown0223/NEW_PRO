"use client";

import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { pickZodLeaf } from "./price-matrix-types";

type Props = {
  kind: "sale" | "purchase";
  onKindChange: (k: "sale" | "purchase") => void;
  priceType: string;
  onPriceTypeChange: (v: string) => void;
  priceTypes: string[];
  serverFieldErrs: Record<string, string>;
  className?: string;
};

export function PriceMatrixFilters({
  kind,
  onKindChange,
  priceType,
  onPriceTypeChange,
  priceTypes,
  serverFieldErrs,
  className
}: Props) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex h-10 shrink-0 items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm">
        <button
          type="button"
          className={cn(
            "px-3 text-sm transition-colors",
            kind === "sale"
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60"
          )}
          onClick={() => onKindChange("sale")}
        >
          Продажа
        </button>
        <button
          type="button"
          className={cn(
            "border-l border-input px-3 text-sm transition-colors",
            kind === "purchase"
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60"
          )}
          onClick={() => onKindChange("purchase")}
        >
          Закуп
        </button>
      </div>

      <div className="min-w-[10rem] flex-1 sm:min-w-[12rem] sm:max-w-[16rem]">
        <FilterSelect
          className="h-10 w-full max-w-none"
          emptyLabel="Тип цены"
          aria-label="Тип цены"
          value={priceType}
          onChange={(e) => onPriceTypeChange(e.target.value)}
        >
          {priceTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </FilterSelect>
        {pickZodLeaf(serverFieldErrs, "price_type") ? (
          <p className="mt-0.5 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "price_type")}</p>
        ) : null}
      </div>
    </div>
  );
}
