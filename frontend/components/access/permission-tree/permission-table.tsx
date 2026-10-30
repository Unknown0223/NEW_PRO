"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { treeKeys } from "@/lib/access-operations-tree";
import { GroupCheckbox, OpKindBadge, type PermissionTreeProps } from "./permission-tree";

type Props = Omit<PermissionTreeProps, "expanded" | "onExpandedChange" | "forceExpanded">;

/** «Таблица»: daraxtning tekis ko'rinishi — Раздел / Группа / Операция / Тип. */
export function PermissionTable({ tree, isOn, onToggle, isDisabled, renderOpExtra }: Props) {
  const rows = useMemo(
    () =>
      tree.flatMap((mod) =>
        mod.sections.flatMap((sec) => sec.operations.map((op) => ({ mod: mod.label, sec: sec.label, op })))
      ),
    [tree]
  );
  const allKeys = useMemo(() => treeKeys(tree), [tree]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="sticky top-0 z-[1] bg-muted/80 text-xs text-muted-foreground backdrop-blur">
          <tr>
            <th scope="col" className="w-10 px-3 py-2">
              <GroupCheckbox keys={allKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label="все видимые операции" />
            </th>
            <th scope="col" className="px-2 py-2 font-medium">Раздел</th>
            <th scope="col" className="px-2 py-2 font-medium">Группа</th>
            <th scope="col" className="px-2 py-2 font-medium">Операция</th>
            <th scope="col" className="px-2 py-2 font-medium">Тип</th>
            {renderOpExtra ? <th scope="col" className="px-2 py-2 font-medium">Состояние</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ mod, sec, op }) => {
            const disabled = isDisabled?.(op.key) ?? false;
            return (
              <tr key={op.key} className="border-t border-border/50 hover:bg-muted/30">
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    checked={isOn(op.key)}
                    disabled={disabled}
                    aria-label={op.label}
                    onChange={(e) => onToggle([op.key], e.target.checked)}
                  />
                </td>
                <td className="px-2 py-1.5 text-muted-foreground">{mod}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{sec}</td>
                <td className={cn("px-2 py-1.5", disabled && "text-muted-foreground")} title={op.key}>
                  {op.label}
                </td>
                <td className="px-2 py-1.5">
                  <OpKindBadge action={op.action} />
                </td>
                {renderOpExtra ? <td className="px-2 py-1.5">{renderOpExtra(op)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
