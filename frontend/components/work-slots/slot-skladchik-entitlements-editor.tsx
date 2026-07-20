"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { SKLADCHIK_ENTITLEMENT_GROUPS, flattenEntitlementKeys } from "@/lib/skladchik-entitlements-ui";

type Props = {
  value: Record<string, boolean>;
  onChange: (next: Record<string, boolean>) => void;
};

/** Разрешения панели складчика — на уровне рабочего места. */
export function SlotSkladchikEntitlementsEditor({ value, onChange }: Props) {
  const allKeys = useMemo(() => flattenEntitlementKeys(), []);
  const selectedTotal = useMemo(
    () => allKeys.filter((k) => value[k] === true).length,
    [allKeys, value]
  );

  function toggle(key: string) {
    onChange({ ...value, [key]: !value[key] });
  }

  function selectAllInGroup(keys: string[], on: boolean) {
    const next = { ...value };
    for (const k of keys) next[k] = on;
    onChange(next);
  }

  function clearAll() {
    onChange(Object.fromEntries(allKeys.map((k) => [k, false])) as Record<string, boolean>);
  }

  function selectAll() {
    onChange(Object.fromEntries(allKeys.map((k) => [k, true])) as Record<string, boolean>);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Разрешения панели складчика</p>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <button type="button" className="text-teal-700 underline-offset-2 hover:underline" onClick={selectAll}>
            Выбрать все
          </button>
          <span className="text-border" aria-hidden>
            |
          </span>
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={clearAll}
          >
            Снять все
          </button>
          <span className="rounded bg-teal-600/12 px-1.5 py-0.5 font-semibold tabular-nums text-teal-900 dark:bg-teal-400/15 dark:text-teal-100">
            {selectedTotal}/{allKeys.length}
          </span>
        </div>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {SKLADCHIK_ENTITLEMENT_GROUPS.map((group, groupIdx) => {
          const keys = group.items.map((i) => i.key);
          const groupOn = keys.filter((k) => value[k] === true).length;
          const groupHeadingId = `slot-sklad-ent-gr-${groupIdx}`;
          return (
            <section
              key={group.title}
              className="overflow-hidden rounded-lg border border-teal-900/12 bg-card dark:border-teal-600/20"
              aria-labelledby={groupHeadingId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-900/10 bg-muted/50 px-3 py-2">
                <h3 id={groupHeadingId} className="text-xs font-semibold uppercase tracking-wide text-teal-900 dark:text-teal-200">
                  {group.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {groupOn}/{keys.length}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] text-teal-700 underline-offset-2 hover:underline"
                    onClick={() => selectAllInGroup(keys, true)}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => selectAllInGroup(keys, false)}
                  >
                    Нет
                  </button>
                </div>
              </div>
              <ul className="grid gap-1 p-2 sm:grid-cols-2">
                {group.items.map((item) => {
                  const on = value[item.key] === true;
                  return (
                    <li key={item.key}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-xs",
                          on
                            ? "border-teal-600/40 bg-teal-50 text-teal-950 dark:border-teal-500/35 dark:bg-teal-950/50 dark:text-teal-50"
                            : "border-transparent bg-muted/20 hover:bg-muted/35"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 accent-teal-600"
                          checked={on}
                          onChange={() => toggle(item.key)}
                        />
                        <span className={cn("min-w-0 flex-1 leading-snug", on && "font-medium")}>{item.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
