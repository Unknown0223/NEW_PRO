"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import {
  accessOpKind,
  moduleKeys,
  sectionKeys,
  triState,
  type AccessTreeModule,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";

export type PermissionTreeProps = {
  tree: readonly AccessTreeModule[];
  isOn: (key: string) => boolean;
  onToggle: (keys: string[], next: boolean) => void;
  isDisabled?: (key: string) => boolean;
  /** Operatsiya qatorining o'ng tomoni (holat belgisi, «может выдавать» va h.k.). */
  renderOpExtra?: (op: AccessTreeOperation) => ReactNode;
  expanded: ReadonlySet<string>;
  onExpandedChange: (next: Set<string>) => void;
  /** Qidiruv faol bo'lsa — hamma narsa ochiq ko'rsatiladi. */
  forceExpanded?: boolean;
};

export function OpKindBadge({ action }: { action: AccessTreeOperation["action"] }) {
  const kind = accessOpKind(action);
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide",
        kind === "view"
          ? "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
      )}
      title={kind === "view" ? "Просмотр" : "Действие"}
    >
      {kind === "view" ? "Просмотр" : "Действие"}
    </span>
  );
}

export function enabledKeys(keys: string[], isDisabled?: (key: string) => boolean): string[] {
  return isDisabled ? keys.filter((k) => !isDisabled(k)) : keys;
}

export function GroupCheckbox({
  keys,
  isOn,
  isDisabled,
  onToggle,
  label
}: {
  keys: string[];
  isOn: (key: string) => boolean;
  isDisabled?: (key: string) => boolean;
  onToggle: (keys: string[], next: boolean) => void;
  label: string;
}) {
  const state = triState(keys, isOn);
  const editable = enabledKeys(keys, isDisabled);
  return (
    <IndeterminateCheckbox
      checked={state === "all"}
      indeterminate={state === "some"}
      disabled={editable.length === 0}
      onChange={() => onToggle(editable, state !== "all")}
      aria-label={`Выбрать все: ${label}`}
      className="h-4 w-4 shrink-0 accent-teal-700"
    />
  );
}

export function PermissionTree({
  tree,
  isOn,
  onToggle,
  isDisabled,
  renderOpExtra,
  expanded,
  onExpandedChange,
  forceExpanded
}: PermissionTreeProps) {
  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onExpandedChange(next);
  };

  return (
    <ul className="space-y-2" role="tree" aria-label="Дерево операций">
      {tree.map((mod) => {
        const modOpen = forceExpanded || expanded.has(mod.id);
        const mKeys = moduleKeys(mod);
        const mOn = mKeys.filter(isOn).length;
        return (
          <li
            key={mod.id}
            role="treeitem"
            aria-expanded={modOpen}
            aria-selected={false}
            className="rounded-lg border border-border/70 bg-card"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <GroupCheckbox keys={mKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label={mod.label} />
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-semibold"
                onClick={() => toggleExpand(mod.id)}
                aria-label={`${modOpen ? "Свернуть" : "Развернуть"} раздел ${mod.label}`}
              >
                {modOpen ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="truncate">{mod.label}</span>
              </button>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {mOn} / {mKeys.length}
              </span>
            </div>
            {modOpen ? (
              <ul role="group" className="space-y-1 border-t border-border/60 px-2 py-2">
                {mod.sections.map((sec) => {
                  const secOpen = forceExpanded || expanded.has(sec.id);
                  const sKeys = sectionKeys(sec);
                  const sOn = sKeys.filter(isOn).length;
                  return (
                    <li key={sec.id} role="treeitem" aria-expanded={secOpen} aria-selected={false} className="rounded-md bg-muted/30">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <GroupCheckbox keys={sKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label={sec.label} />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium"
                          onClick={() => toggleExpand(sec.id)}
                          aria-label={`${secOpen ? "Свернуть" : "Развернуть"} группу ${sec.label}`}
                        >
                          {secOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <span className="truncate">{sec.label}</span>
                        </button>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {sOn} / {sKeys.length}
                        </span>
                      </div>
                      {secOpen ? (
                        <ul role="group" className="pb-1.5 pl-8 pr-2">
                          {sec.operations.map((op) => {
                            const disabled = isDisabled?.(op.key) ?? false;
                            const id = `op-${op.key}`;
                            return (
                              <li
                                key={op.key}
                                role="treeitem"
                                aria-selected={isOn(op.key)}
                                className="flex flex-wrap items-center gap-2 rounded px-1.5 py-1 hover:bg-background/70"
                              >
                                <input
                                  id={id}
                                  type="checkbox"
                                  className="h-4 w-4 shrink-0 accent-teal-700"
                                  checked={isOn(op.key)}
                                  disabled={disabled}
                                  onChange={(e) => onToggle([op.key], e.target.checked)}
                                />
                                <label
                                  htmlFor={id}
                                  className={cn("min-w-0 flex-1 text-[13px] leading-snug", disabled && "text-muted-foreground")}
                                  title={op.key}
                                >
                                  {op.label}
                                </label>
                                <OpKindBadge action={op.action} />
                                {renderOpExtra?.(op)}
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
