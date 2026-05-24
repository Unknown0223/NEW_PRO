"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./work-slots-utils";

type Props = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
};

/** Kartochka / jadval — sarlavha qatorida. */
export function WorkSlotsViewToggle({ viewMode, onViewModeChange }: Props) {
  return (
    <div
      className="flex rounded-md border border-input bg-background"
      role="group"
      aria-label="Режим отображения"
    >
      <Button
        type="button"
        variant={viewMode === "grid" ? "secondary" : "ghost"}
        size="sm"
        className="h-9 gap-1 rounded-r-none px-2.5"
        title="Карточки"
        onClick={() => onViewModeChange("grid")}
      >
        <LayoutGrid className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Карточки</span>
      </Button>
      <Button
        type="button"
        variant={viewMode === "list" ? "secondary" : "ghost"}
        size="sm"
        className={cn("h-9 gap-1 rounded-l-none border-l px-2.5")}
        title="Таблица"
        onClick={() => onViewModeChange("list")}
      >
        <List className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Таблица</span>
      </Button>
    </div>
  );
}
