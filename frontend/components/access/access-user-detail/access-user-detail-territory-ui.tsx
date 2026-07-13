"use client";

import { useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type AccessTerritoryTreeNode,
  collectSubtreeTerritoryIdStrings,
  sortedTerritoryTreeLevel
} from "./access-user-detail.types";

export function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className,
  title,
  "aria-label": ariaLabel
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={onChange}
      title={title}
      aria-label={ariaLabel}
      className={cn("mt-0.5 h-4 w-4 shrink-0 accent-teal-700", className)}
    />
  );
}

export function TerritoryReferenceTreeRows({
  nodes,
  depth,
  treeExpanded,
  setTreeExpanded,
  modalSel,
  setModalSel,
  territoryDisabled
}: {
  nodes: AccessTerritoryTreeNode[];
  depth: number;
  treeExpanded: Set<number>;
  setTreeExpanded: Dispatch<SetStateAction<Set<number>>>;
  modalSel: Set<string>;
  setModalSel: Dispatch<SetStateAction<Set<string>>>;
  territoryDisabled: boolean;
}) {
  const sorted = sortedTerritoryTreeLevel(nodes);
  return (
    <div className={cn("space-y-0", depth > 0 && "mt-0.5 border-l border-dashed border-border/45 pl-2.5")}>
      {sorted.map((node) => {
        const ch = node.children ?? [];
        const hasChildren = ch.length > 0;
        const open = treeExpanded.has(node.id);
        const desc = collectSubtreeTerritoryIdStrings(node);
        const allIn = desc.length > 0 && desc.every((id) => modalSel.has(id));
        const someIn = desc.some((id) => modalSel.has(id)) && !allIn;

        return (
          <div key={node.id} className={cn("py-0.5", !node.is_active && "opacity-70")}>
            <div className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-25"
                disabled={!hasChildren}
                aria-expanded={hasChildren ? open : undefined}
                aria-label={open ? "Свернуть" : "Развернуть"}
                onClick={() => {
                  if (!hasChildren) return;
                  setTreeExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {hasChildren ? (
                  open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )
                ) : (
                  <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                <IndeterminateCheckbox
                  checked={allIn}
                  indeterminate={someIn}
                  disabled={territoryDisabled}
                  onChange={(e) => {
                    setModalSel((prev) => {
                      const n = new Set(prev);
                      if (e.target.checked) for (const id of desc) n.add(id);
                      else for (const id of desc) n.delete(id);
                      return n;
                    });
                  }}
                />
                <span
                  className="min-w-0 text-sm font-semibold uppercase tracking-wide text-foreground [overflow-wrap:anywhere] sm:truncate"
                  title={node.code ? `${node.name} · ${node.code}` : node.name}
                >
                  {(node.name || "—").trim()}
                </span>
              </label>
            </div>
            {hasChildren && open ? (
              <TerritoryReferenceTreeRows
                nodes={ch}
                depth={depth + 1}
                treeExpanded={treeExpanded}
                setTreeExpanded={setTreeExpanded}
                modalSel={modalSel}
                setModalSel={setModalSel}
                territoryDisabled={territoryDisabled}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
