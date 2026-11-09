"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import {
  accessOpKind,
  isFlatAccessModule,
  type AccessTreeModule,
  type AccessTreeOperation,
  type AccessTreeSection
} from "@/lib/access-operations-tree";

export function viewKeysOfOps(ops: AccessTreeOperation[]) {
  return ops.filter((o) => accessOpKind(o.action) === "view").map((o) => o.key);
}

export function AccessRoleDefaultsOpPickTree({
  tree,
  expanded,
  forceOpen,
  isOn,
  onToggleOpen,
  onToggleView,
  onToggleKey
}: {
  tree: AccessTreeModule[];
  expanded: ReadonlySet<string>;
  forceOpen: boolean;
  isOn: (key: string) => boolean;
  onToggleOpen: (id: string) => void;
  onToggleView: (ops: AccessTreeOperation[], next: boolean) => void;
  onToggleKey: (key: string, next: boolean) => void;
}) {
  const open = (id: string) => forceOpen || expanded.has(id);
  const box = (ops: AccessTreeOperation[]) => {
    const keys = ops.map((o) => o.key);
    const on = keys.filter(isOn).length;
    return { keys, all: keys.length > 0 && on === keys.length, some: on > 0 && on < keys.length, ops };
  };
  const renderOps = (ops: AccessTreeOperation[]) =>
    ops.map((op) => (
      <label key={op.key} className="flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-muted/50">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-teal-700"
          checked={isOn(op.key)}
          onChange={(e) => onToggleKey(op.key, e.target.checked)}
        />
        <span className="min-w-0 flex-1 truncate">{op.label}</span>
      </label>
    ));
  const renderSection = (mod: AccessTreeModule, sec: AccessTreeSection) => {
    if (isFlatAccessModule(mod)) return <div key={sec.id}>{renderOps(sec.operations)}</div>;
    const st = box(sec.operations);
    const secOpen = open(sec.id);
    return (
      <div key={sec.id} className="ml-3">
        <div className="flex items-center gap-1.5 px-1 py-1">
          <button type="button" className="text-muted-foreground" onClick={() => onToggleOpen(sec.id)} aria-label={sec.label}>
            {secOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <IndeterminateCheckbox
            checked={st.all}
            indeterminate={st.some}
            className="h-3.5 w-3.5 accent-teal-700"
            onChange={() => onToggleView(sec.operations, st.some || st.all ? false : true)}
          />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-medium" onClick={() => onToggleOpen(sec.id)}>
            {sec.label}
          </button>
        </div>
        {secOpen ? <div className="ml-4 border-l border-border/70 pl-1">{renderOps(sec.operations)}</div> : null}
      </div>
    );
  };
  return (
    <ul>
      {tree.map((mod) => {
        const allOps = mod.sections.flatMap((s) => s.operations);
        const st = box(allOps);
        const modOpen = open(mod.id);
        return (
          <li key={mod.id} className="border-b border-border/50">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button type="button" className="text-muted-foreground" onClick={() => onToggleOpen(mod.id)} aria-label={mod.label}>
                {modOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold" onClick={() => onToggleOpen(mod.id)}>
                {mod.label}
              </button>
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <IndeterminateCheckbox
                  checked={st.all}
                  indeterminate={st.some}
                  className="h-3.5 w-3.5 accent-teal-700"
                  onChange={() => onToggleView(allOps, st.some || st.all ? false : true)}
                />
                Выбрать все
              </label>
            </div>
            {modOpen ? <div className="pb-1">{mod.sections.map((sec) => renderSection(mod, sec))}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
