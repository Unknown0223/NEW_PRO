"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { AccessCompactSwitch } from "@/components/access/access-compact-switch";
import { isFlatAccessModule, type AccessTreeModule } from "@/lib/access-operations-tree";

export function AccessRoleDefaultsRoleGrantBranch({
  tree,
  grant,
  expanded,
  onToggleOpen,
  onGrant
}: {
  tree: AccessTreeModule[];
  grant: Set<string>;
  expanded: Set<string>;
  onToggleOpen: (id: string) => void;
  onGrant: (keys: string[], next: boolean) => void;
}) {
  if (tree.length === 0) {
    return <p className="px-3 py-2 text-[11px] text-muted-foreground">Сначала отметьте операции слева</p>;
  }
  const onCount = (keys: string[]) => keys.filter((k) => grant.has(k)).length;
  const allOn = (keys: string[]) => keys.length > 0 && onCount(keys) === keys.length;
  const hint = (keys: string[]) => {
    const n = onCount(keys);
    if (n === 0) return "Только просмотр";
    if (n === keys.length) return "Можно выдавать другим";
    return `Выдавать: ${n} из ${keys.length}`;
  };
  const Row = ({
    label,
    keys,
    open,
    onOpen,
    depth
  }: {
    label: string;
    keys: string[];
    open?: boolean;
    onOpen?: () => void;
    depth: number;
  }) => (
    <div
      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {onOpen ? (
        <button type="button" className="mt-0.5 text-muted-foreground" onClick={onOpen} aria-label={label}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-snug text-foreground">{label}</span>
        <span className="block text-[10.5px] leading-snug text-muted-foreground">{hint(keys)}</span>
      </span>
      <AccessCompactSwitch checked={allOn(keys)} title={hint(keys)} onChange={(next) => onGrant(keys, next)} />
    </div>
  );
  return (
    <div className="space-y-0.5 border-t border-border/60 bg-muted/20 px-1 py-1">
      {tree.map((mod) => {
        const keys = mod.sections.flatMap((s) => s.operations.map((o) => o.key));
        const open = expanded.has(mod.id);
        const flat = isFlatAccessModule(mod);
        return (
          <div key={mod.id}>
            <Row label={mod.label} keys={keys} open={open} onOpen={() => onToggleOpen(mod.id)} depth={0} />
            {open ? (
              flat ? (
                mod.sections.flatMap((s) => s.operations).map((op) => (
                  <Row key={op.key} label={op.label} keys={[op.key]} depth={1} />
                ))
              ) : (
                mod.sections.map((sec) => {
                  const sKeys = sec.operations.map((o) => o.key);
                  const secOpen = expanded.has(sec.id);
                  return (
                    <div key={sec.id}>
                      <Row
                        label={sec.label}
                        keys={sKeys}
                        open={secOpen}
                        onOpen={() => onToggleOpen(sec.id)}
                        depth={1}
                      />
                      {secOpen
                        ? sec.operations.map((op) => (
                            <Row key={op.key} label={op.label} keys={[op.key]} depth={2} />
                          ))
                        : null}
                    </div>
                  );
                })
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
