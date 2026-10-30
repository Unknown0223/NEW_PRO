"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import { AccessCompactSwitch } from "@/components/access/access-compact-switch";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import {
  filterAccessTree,
  isFlatAccessModule,
  moduleKeys,
  sectionKeys,
  type AccessTreeModule,
  type AccessTreeOperation,
  type AccessTreeSection
} from "@/lib/access-operations-tree";

type Props = {
  tenantSlug: string;
  selected: ReadonlySet<string>;
  grant: ReadonlySet<string>;
  disabled?: boolean;
  search: string;
  onChange: (nextSelected: Set<string>, nextGrant: Set<string>) => void;
};

function keysOf(ops: AccessTreeOperation[]) {
  return ops.map((o) => o.key);
}

export function AccessRoleDefaultsGrantTree({ tenantSlug, selected, grant, disabled, search, onChange }: Props) {
  const treeQ = useAccessOperationsTree(tenantSlug);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => filterAccessTree(treeQ.data ?? [], search), [treeQ.data, search]);
  const searching = search.trim().length > 0;
  const open = (id: string) => searching || expanded.has(id);
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const apply = (opKeys: string[], select: boolean | null, grantOn: boolean | null) => {
    const sel = new Set(selected);
    const gr = new Set(grant);
    for (const k of opKeys) {
      if (select === true) sel.add(k);
      if (select === false) {
        sel.delete(k);
        gr.delete(k);
      }
      if (grantOn === true) {
        sel.add(k);
        gr.add(k);
      }
      if (grantOn === false) gr.delete(k);
    }
    onChange(sel, gr);
  };

  const tri = (keys: string[], bag: ReadonlySet<string>) => {
    const on = keys.filter((k) => bag.has(k)).length;
    return { all: keys.length > 0 && on === keys.length, some: on > 0 && on < keys.length };
  };

  const renderOps = (ops: AccessTreeOperation[]) =>
    ops.map((op) => (
      <div key={op.key} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/40">
        <input
          type="checkbox"
          className="h-4 w-4 accent-teal-700"
          checked={selected.has(op.key)}
          disabled={disabled}
          onChange={(e) => apply([op.key], e.target.checked, e.target.checked ? null : false)}
        />
        <span className="min-w-0 flex-1 truncate text-[13px]">{op.label}</span>
        <AccessCompactSwitch
          checked={grant.has(op.key)}
          disabled={disabled || !selected.has(op.key)}
          title={grant.has(op.key) ? "Может выдавать другим" : "Только просмотр"}
          onChange={(next) => apply([op.key], null, next)}
        />
      </div>
    ));

  const sectionHead = (sec: AccessTreeSection, nested: boolean) => {
    const keys = sectionKeys(sec);
    const sel = tri(keys, selected);
    const gr = tri(keys, grant);
    const secOpen = open(sec.id);
    return (
      <div key={sec.id} className={nested ? "ml-4" : ""}>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <button type="button" className="text-muted-foreground" onClick={() => toggleOpen(sec.id)}>
            {secOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <IndeterminateCheckbox
            checked={sel.all}
            indeterminate={sel.some}
            disabled={disabled}
            className="h-4 w-4 accent-teal-700"
            onChange={() => apply(keys, !sel.all, !sel.all ? null : false)}
          />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-medium" onClick={() => toggleOpen(sec.id)}>
            {sec.label}
          </button>
          <AccessCompactSwitch
            checked={gr.all}
            disabled={disabled}
            title={gr.all ? "Вся группа может выдавать другим" : "Только просмотр для всей группы"}
            onChange={(next) => apply(keys, null, next)}
          />
        </div>
        {secOpen ? <div className="ml-6 border-l border-border/70 pl-1">{renderOps(sec.operations)}</div> : null}
      </div>
    );
  };

  const renderModule = (mod: AccessTreeModule) => {
    const keys = moduleKeys(mod);
    const sel = tri(keys, selected);
    const gr = tri(keys, grant);
    const modOpen = open(mod.id);
    const flat = isFlatAccessModule(mod);
    return (
      <li key={mod.id} className="border-b border-border/60">
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-2">
          <button type="button" onClick={() => toggleOpen(mod.id)} aria-label={mod.label}>
            {modOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold" onClick={() => toggleOpen(mod.id)}>
            {mod.label}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IndeterminateCheckbox
              checked={sel.all}
              indeterminate={sel.some}
              disabled={disabled}
              className="h-4 w-4 accent-teal-700"
              onChange={() => apply(keys, !sel.all, !sel.all ? null : false)}
            />
            Выбрать все
          </label>
          <AccessCompactSwitch
            checked={gr.all}
            disabled={disabled}
            title={gr.all ? "Весь раздел может выдавать другим" : "Только просмотр для всего раздела"}
            onChange={(next) => apply(keys, null, next)}
          />
        </div>
        {modOpen ? (
          <div className="py-1">
            {flat
              ? mod.sections.map((sec) => <div key={sec.id} className="px-2">{renderOps(sec.operations)}</div>)
              : mod.sections.map((sec) => sectionHead(sec, true))}
          </div>
        ) : null}
      </li>
    );
  };

  if (treeQ.isLoading) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Загрузка дерева…</p>;
  if (tree.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>;
  return <ul>{tree.map(renderModule)}</ul>;
}
