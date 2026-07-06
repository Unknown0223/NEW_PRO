"use client";

import { ChevronDown } from "lucide-react";
import { HeaderCell, LevelCell } from "./approver-cell";
import { usedColumnHeaderExcludeIds, usedLevelExcludeIds } from "./approver-used-options";
import type { ApproverPerson } from "./approvers-api";

export type EditableRow = {
  supervisor_user_id: number;
  supervisor_name: string;
  levels: (number | null)[];
};

type Props = {
  rows: EditableRow[];
  employees: ApproverPerson[];
  leaders: number[];
  maxLevels: number;
  canWrite: boolean;
  /** Supervayzer nomi bo'yicha ko'rinadigan qatorlar filtri (indekslar buzilmaydi). */
  supervisorFilter?: string;
  nameOf: (id: number) => string;
  onUpdateLevel: (rowIdx: number, levelIdx: number, value: number | null) => void;
  onAddLevelBefore: (rowIdx: number, levelIdx: number) => void;
  onAddLevelAfter: (rowIdx: number, levelIdx: number) => void;
  onRemoveLevel: (rowIdx: number, levelIdx: number) => void;
  onAddColumnBefore: (levelIdx: number) => void;
  onAddColumnAfter: (levelIdx: number) => void;
  onRemoveColumn: (levelIdx: number) => void;
  onApplyColumn: (levelIdx: number, value: number) => void;
};

function columnCommonValue(rows: EditableRow[], levelIdx: number): number | null {
  if (rows.length === 0) return null;
  const first = rows[0].levels[levelIdx] ?? null;
  if (first == null) return null;
  return rows.every((r) => (r.levels[levelIdx] ?? null) === first) ? first : null;
}

export function ApproverTable(props: Props) {
  const { rows, employees, leaders, maxLevels, canWrite, nameOf } = props;
  const totalColumns = maxLevels + leaders.length;
  const gridTemplate = `minmax(220px,1.6fr) repeat(${totalColumns}, minmax(150px,1fr))`;
  const filter = (props.supervisorFilter ?? "").trim().toLowerCase();
  const matches = (name: string) => filter === "" || name.toLowerCase().includes(filter);
  const visibleCount = rows.filter((r) => matches(r.supervisor_name)).length;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-max">
        {/* Header */}
        <div
          className="grid border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="px-4 py-2.5">Супервайзеры</div>
          {Array.from({ length: maxLevels }).map((_, i) => (
            <div key={`h-${i}`} className="flex items-center justify-center px-1.5 py-1.5">
              <HeaderCell
                label={`Степень ${i + 1}`}
                columnValue={columnCommonValue(rows, i)}
                employees={employees}
                excludeIds={usedColumnHeaderExcludeIds(leaders, rows, i)}
                canWrite={canWrite}
                canRemove={i > 0}
                nameOf={nameOf}
                onApplyAll={(v) => props.onApplyColumn(i, v)}
                onAddBefore={() => props.onAddColumnBefore(i)}
                onAddAfter={() => props.onAddColumnAfter(i)}
                onRemove={() => props.onRemoveColumn(i)}
              />
            </div>
          ))}
          {leaders.map((_, j) => (
            <div key={`hl-${j}`} className="flex items-center justify-center px-1.5 py-1.5 text-center text-muted-foreground/70">
              Степень {maxLevels + j + 1}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Для выбранного направления нет супервайзеров.
            </div>
          ) : visibleCount === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              По запросу супервайзеры не найдены.
            </div>
          ) : (
            rows.map((row, rowIdx) => {
              if (!matches(row.supervisor_name)) return null;
              return (
              <div
                key={row.supervisor_user_id}
                className="grid items-center border-b border-border/60 last:border-b-0 hover:bg-muted/20"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="whitespace-pre-line px-4 py-2.5 text-xs font-medium leading-snug text-foreground">
                  {row.supervisor_name}
                </div>
                {Array.from({ length: maxLevels }).map((_, lvlIdx) => {
                  const hasLevel = lvlIdx < row.levels.length;
                  const canRemove = row.levels.length > 1 && hasLevel;
                  return (
                    <div key={`c-${rowIdx}-${lvlIdx}`} className="px-1.5 py-1.5">
                      {hasLevel ? (
                        <LevelCell
                          value={row.levels[lvlIdx] ?? null}
                          employees={employees}
                          excludeIds={usedLevelExcludeIds(leaders, rows, rowIdx, lvlIdx)}
                          canWrite={canWrite}
                          canRemove={canRemove}
                          nameOf={nameOf}
                          onChange={(v) => props.onUpdateLevel(rowIdx, lvlIdx, v)}
                          onAddBefore={() => props.onAddLevelBefore(rowIdx, lvlIdx)}
                          onAddAfter={() => props.onAddLevelAfter(rowIdx, lvlIdx)}
                          onRemove={() => props.onRemoveLevel(rowIdx, lvlIdx)}
                        />
                      ) : (
                        <div className="h-9 rounded-lg border border-dashed border-border bg-muted/30" />
                      )}
                    </div>
                  );
                })}
                {leaders.map((leaderId, j) => (
                  <div key={`cl-${rowIdx}-${j}`} className="px-1.5 py-1.5">
                    <div className="flex h-9 items-center justify-between gap-1 truncate rounded-lg border border-border bg-muted/40 px-2.5 text-xs text-muted-foreground">
                      <span className="truncate" title={nameOf(leaderId)}>{nameOf(leaderId)}</span>
                      <ChevronDown className="size-3.5 shrink-0 opacity-40" />
                    </div>
                  </div>
                ))}
              </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
