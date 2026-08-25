"use client";

/**
 * Kartochka/jadval toggle — hozir asosiy ko‘rinish jadval (Agents/Expeditors kabi).
 * Saqlangan `grid` prefs e’tiborga olinmaydi; UI faqat jadvalni ko‘rsatadi.
 */
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  viewMode?: "grid" | "list";
  onViewModeChange?: (mode: "grid" | "list") => void;
};

export function WorkSlotsViewToggle(_props: Props) {
  return (
    <div className="flex rounded-md border border-input bg-background" role="group" aria-label="Режим отображения">
      <Button type="button" variant="secondary" size="sm" className="h-9 gap-1 px-2.5" disabled title="Таблица">
        <List className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Таблица</span>
      </Button>
    </div>
  );
}
