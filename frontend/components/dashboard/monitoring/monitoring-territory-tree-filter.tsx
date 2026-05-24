"use client";

import {
  buildTerritoryTreeIndex,
  nodeMatchesSearch,
  territorySelectionEqual
} from "@/components/dashboard/monitoring/monitoring-territory-tree-utils";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TerritoryNode } from "@/lib/territory-tree";
import { sortForest } from "@/lib/territory-tree";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

const checkboxCls =
  "mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={checkboxCls}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

const TerritoryTreeRows = memo(function TerritoryTreeRows({
  nodes,
  depth,
  expanded,
  setExpanded,
  selected,
  onToggle,
  searchQ,
  subtreeIdsByNodeId
}: {
  nodes: readonly TerritoryNode[];
  depth: number;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  selected: Set<string>;
  onToggle: (nodeId: string, checked: boolean) => void;
  searchQ: string;
  subtreeIdsByNodeId: Map<string, readonly string[]>;
}) {
  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-dashed border-slate-200 pl-2")}>
      {nodes.map((node) => {
        if (node.active === false) return null;
        if (searchQ && !nodeMatchesSearch(node, searchQ)) return null;

        const children = node.children ?? [];
        const hasChildren = children.length > 0;
        const open = expanded.has(node.id);
        const desc = subtreeIdsByNodeId.get(node.id) ?? [node.id];
        const allIn = desc.every((id) => selected.has(id));
        const someIn = desc.some((id) => selected.has(id)) && !allIn;

        return (
          <div key={node.id} className="py-0.5">
            <div className="flex items-start gap-1">
              {hasChildren ? (
                <button
                  type="button"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-slate-100"
                  onClick={() =>
                    setExpanded((prev) => {
                      const n = new Set(prev);
                      if (n.has(node.id)) n.delete(node.id);
                      else n.add(node.id);
                      return n;
                    })
                  }
                >
                  {open ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 py-0.5">
                <IndeterminateCheckbox
                  checked={allIn}
                  indeterminate={someIn}
                  onChange={(checked) => onToggle(node.id, checked)}
                />
                <span className="min-w-0 text-[13px] font-medium text-slate-800">{node.name}</span>
              </label>
            </div>
            {hasChildren && open ? (
              <TerritoryTreeRows
                nodes={children}
                depth={depth + 1}
                expanded={expanded}
                setExpanded={setExpanded}
                selected={selected}
                onToggle={onToggle}
                searchQ={searchQ}
                subtreeIdsByNodeId={subtreeIdsByNodeId}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
});

export const MonitoringTerritoryTreeFilter = memo(function MonitoringTerritoryTreeFilter({
  nodes,
  selectedIds,
  onChange,
  triggerClassName,
  disabled
}: {
  nodes: TerritoryNode[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const forest = useMemo(() => sortForest(nodes), [nodes]);
  const treeIndex = useMemo(() => buildTerritoryTreeIndex(forest), [forest]);
  const committed = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [pending, setPending] = useState<Set<string>>(() => new Set(selectedIds));
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchQ = deferredSearch.trim().toLowerCase();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 300 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) setPending(new Set(selectedIds));
  }, [selectedIds, open]);

  useEffect(() => {
    if (!searchQ) return;
    const expandAll = (list: TerritoryNode[], acc: Set<string>) => {
      for (const n of list) {
        if (nodeMatchesSearch(n, searchQ)) acc.add(n.id);
        if (n.children?.length) expandAll(n.children, acc);
      }
    };
    const acc = new Set<string>();
    expandAll(forest, acc);
    setExpanded(acc);
  }, [searchQ, forest]);

  const summary = useMemo(() => {
    if (committed.size === 0) return "Территория";
    if (committed.size === 1) {
      const id = [...committed][0]!;
      return treeIndex.idToName.get(id) ?? "Выбрано: 1";
    }
    return `Выбрано: ${committed.size}`;
  }, [committed, treeIndex.idToName]);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const w = Math.min(Math.max(r.width, 300), vw - 16);
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    setCoords({ top: r.bottom + 6, left, width: w });
  }, []);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const closePopover = useCallback(() => {
    const next = Array.from(pendingRef.current);
    if (!territorySelectionEqual(next, selectedIds)) onChange(next);
    setOpen(false);
  }, [selectedIds, onChange]);

  const openPopover = useCallback(() => {
    setPending(new Set(selectedIds));
    setOpen(true);
  }, [selectedIds]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const n = e.target as Node;
      if (triggerRef.current?.contains(n) || popRef.current?.contains(n)) return;
      closePopover();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, closePopover]);

  const onToggle = useCallback(
    (nodeId: string, checked: boolean) => {
      const ids = treeIndex.subtreeIdsByNodeId.get(nodeId) ?? [nodeId];
      setPending((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [treeIndex.subtreeIdsByNodeId]
  );

  const popover =
    open && mounted ? (
      <div
        ref={popRef}
        id={listId}
        role="dialog"
        className="fixed z-[200] flex max-h-[min(420px,70vh)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        style={{ top: coords.top, left: coords.left, width: coords.width }}
      >
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск"
              className="h-8 pl-8 text-xs"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {forest.length === 0 ? (
            <p className="px-1 py-4 text-xs text-muted-foreground">Справочник территорий пуст</p>
          ) : (
            <TerritoryTreeRows
              nodes={forest}
              depth={0}
              expanded={expanded}
              setExpanded={setExpanded}
              selected={pending}
              onToggle={onToggle}
              searchQ={searchQ}
              subtreeIdsByNodeId={treeIndex.subtreeIdsByNodeId}
            />
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? listId : undefined}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-left text-xs text-slate-700 shadow-sm hover:border-slate-300",
          disabled && "pointer-events-none opacity-50",
          triggerClassName
        )}
        onClick={() => (open ? closePopover() : openPopover())}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
});
