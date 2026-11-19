"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { staffRoleGroupLabel } from "./access-user-detail.types";

export type ScopeListItem = {
  id: string;
  label: string;
  sub?: string;
  searchText?: string;
  roleKey?: string;
};

export type ScopeStaffGroup = { role: string; items: ScopeListItem[] };

function ScopeRow({
  item,
  kept,
  readOnly,
  pending,
  Icon,
  showSub,
  onToggle
}: {
  item: ScopeListItem;
  kept: Set<string>;
  readOnly: boolean;
  pending: boolean;
  Icon: LucideIcon;
  showSub: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  const on = kept.has(item.id);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 px-3 py-2.5 text-sm",
        on ? "bg-card" : "bg-rose-50/80 text-muted-foreground dark:bg-rose-950/30"
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-teal-700"
        checked={on}
        disabled={readOnly || pending}
        aria-label={on ? `Оставить ${item.label}` : `Вернуть ${item.label}`}
        onChange={(e) => onToggle(item.id, e.target.checked)}
      />
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate", !on && "line-through")} title={item.label}>
        {item.label}
      </span>
      {showSub && item.sub ? (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {item.sub}
        </span>
      ) : null}
      {!on ? <span className="shrink-0 text-[11px] text-rose-700">будет убрано</span> : null}
      {!readOnly && on ? (
        <button
          type="button"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:hover:bg-rose-950"
          disabled={pending}
          aria-label={`Убрать ${item.label}`}
          onClick={() => onToggle(item.id, false)}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Убрать
        </button>
      ) : null}
    </div>
  );
}

export function AccessScopeAttachedList({
  shown,
  staffGroups,
  kept,
  shownIds,
  allShownOn,
  readOnly,
  pending,
  Icon,
  onToggle,
  onBulk
}: {
  shown: ScopeListItem[];
  staffGroups: ScopeStaffGroup[] | null;
  kept: Set<string>;
  shownIds: string[];
  allShownOn: boolean;
  readOnly: boolean;
  pending: boolean;
  Icon: LucideIcon;
  onToggle: (id: string, on: boolean) => void;
  onBulk: (ids: string[], on: boolean) => void;
}) {
  const [staffCollapsed, setStaffCollapsed] = useState<string[]>([]);

  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
      {!readOnly && shownIds.length > 1 ? (
        <li className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-700"
            checked={allShownOn}
            disabled={pending}
            aria-label="Отметить все видимые"
            onChange={(e) => onBulk(shownIds, e.target.checked)}
          />
          <span className="font-medium text-muted-foreground">Все видимые</span>
        </li>
      ) : null}
      {staffGroups
        ? staffGroups.map(({ role, items: groupItems }) => {
            const expanded = !staffCollapsed.includes(role);
            const leafIds = groupItems.map((i) => i.id);
            const allIn = leafIds.length > 0 && leafIds.every((id) => kept.has(id));
            return (
              <li key={role} className="list-none">
                <div className="flex items-center gap-1 bg-muted/30 px-1.5 py-1.5">
                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    onClick={() =>
                      setStaffCollapsed((prev) =>
                        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                      )
                    }
                    aria-expanded={expanded}
                    aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
                    {staffRoleGroupLabel(role)}
                  </span>
                  <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
                    {groupItems.length}
                  </span>
                  {!readOnly ? (
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-teal-700"
                        checked={allIn}
                        disabled={pending}
                        aria-label={`Отметить всех: ${staffRoleGroupLabel(role)}`}
                        onChange={(e) => onBulk(leafIds, e.target.checked)}
                      />
                      Все
                    </label>
                  ) : null}
                </div>
                {expanded
                  ? groupItems.map((i) => (
                      <div key={i.id} className="border-t border-border/50">
                        <ScopeRow
                          item={i}
                          kept={kept}
                          readOnly={readOnly}
                          pending={pending}
                          Icon={Icon}
                          showSub={false}
                          onToggle={onToggle}
                        />
                      </div>
                    ))
                  : null}
              </li>
            );
          })
        : shown.map((i) => (
            <li key={i.id}>
              <ScopeRow
                item={i}
                kept={kept}
                readOnly={readOnly}
                pending={pending}
                Icon={Icon}
                showSub
                onToggle={onToggle}
              />
            </li>
          ))}
    </ul>
  );
}
