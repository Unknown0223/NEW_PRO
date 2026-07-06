"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AccessTableProps {
  items: Array<{
    id: number;
    code: string | null;
    full_name: string;
    login: string;
    role: string;
    position: string | null;
    is_active: boolean;
  }>;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleAll: () => void;
  isAllSelected: boolean;
  isLoading: boolean;
  onUserClick: (id: number) => void;
  itemHeight?: number;
}

export function AccessTable({
  items,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  isAllSelected,
  isLoading,
  onUserClick,
  itemHeight = 40
}: AccessTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 10
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Загрузка данных…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">Нет данных для отображения.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <th className="w-12 px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={() => onToggleAll()}
                className="h-4 w-4 accent-teal-700"
              />
            </th>
            <th className="min-w-0 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Пользователь</th>
            <th className="w-20 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Роль</th>
            <th className="w-32 px-2 py-2 text-left text-xs font-medium text-muted-foreground">Должность</th>
            <th className="w-24 px-2 py-2 text-center text-xs font-medium text-muted-foreground">Статус</th>
            <th className="w-20 px-2 py-2 text-center text-xs font-medium text-muted-foreground">Действия</th>
          </tr>
        </thead>
        <tbody>
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            const isSelected = selectedIds.has(item.id);
            return (
              <tr
                key={virtualRow.key}
                className={cn("border-b border-border/50 cursor-pointer", isSelected && "bg-teal-500/10")}
                data-index={virtualRow.index}
                style={{ height: virtualRow.size }}
                onClick={() => onUserClick(item.id)}
              >
                <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.id)}
                    className="h-4 w-4 accent-teal-700"
                  />
                </td>
                <td className="min-w-0 px-2 py-1.5">
                  <span className="text-sm">
                    {item.code ? `[${item.code}] ` : ""}
                    {item.full_name || item.login}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-xs">{item.role}</td>
                <td className="px-2 py-1.5 text-xs text-muted-foreground truncate">{item.position || "—"}</td>
                <td className="px-2 py-1.5 text-center">
                  <span
                    className={cn(
                      "inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                      item.is_active ? "bg-emerald-600/15 text-emerald-800" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.is_active ? "Активный" : "Неактивный"}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-6 px-1 text-xs">
                    →
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}