import type { EditableRow } from "./approver-table";
import type { ApproverConfig, ApproverOptions } from "./approvers-api";

const DEFAULT_LEVELS = 2;

/** Server config + options'dan tahrirlanadigan qatorlarni quradi (supervayzerlar bo'yicha). */
export function buildRows(options: ApproverOptions, config: ApproverConfig | undefined): EditableRow[] {
  const savedBySupervisor = new Map<number, (number | null)[]>();
  for (const r of config?.rows ?? []) savedBySupervisor.set(r.supervisor_user_id, r.levels);
  return options.supervisors.map((s) => {
    const saved = savedBySupervisor.get(s.id);
    return {
      supervisor_user_id: s.id,
      supervisor_name: s.name,
      levels: saved && saved.length > 0 ? [...saved] : Array.from({ length: DEFAULT_LEVELS }, () => null)
    };
  });
}

export function maxLevels(rows: EditableRow[]): number {
  return Math.max(1, ...rows.map((r) => r.levels.length));
}

function mapRow(rows: EditableRow[], rowIdx: number, fn: (levels: (number | null)[]) => (number | null)[]): EditableRow[] {
  return rows.map((r, i) => (i === rowIdx ? { ...r, levels: fn([...r.levels]) } : r));
}

export function updateLevel(rows: EditableRow[], rowIdx: number, levelIdx: number, value: number | null): EditableRow[] {
  return mapRow(rows, rowIdx, (levels) => {
    if (levelIdx < levels.length) levels[levelIdx] = value;
    return levels;
  });
}

export function addLevelBefore(rows: EditableRow[], rowIdx: number, levelIdx: number): EditableRow[] {
  return mapRow(rows, rowIdx, (levels) => {
    levels.splice(levelIdx, 0, null);
    return levels;
  });
}

export function addLevelAfter(rows: EditableRow[], rowIdx: number, levelIdx: number): EditableRow[] {
  return mapRow(rows, rowIdx, (levels) => {
    levels.splice(levelIdx + 1, 0, null);
    return levels;
  });
}

export function removeLevel(rows: EditableRow[], rowIdx: number, levelIdx: number): EditableRow[] {
  return mapRow(rows, rowIdx, (levels) => {
    const next = levels.filter((_, i) => i !== levelIdx);
    return next.length > 0 ? next : [null];
  });
}

export function addColumnBefore(rows: EditableRow[], levelIdx: number): EditableRow[] {
  return rows.map((r) => {
    const levels = [...r.levels];
    levels.splice(levelIdx, 0, null);
    return { ...r, levels };
  });
}

export function addColumnAfter(rows: EditableRow[], levelIdx: number): EditableRow[] {
  return rows.map((r) => {
    const levels = [...r.levels];
    levels.splice(levelIdx + 1, 0, null);
    return { ...r, levels };
  });
}

export function removeColumn(rows: EditableRow[], levelIdx: number): EditableRow[] {
  return rows.map((r) => {
    let levels = r.levels.length > levelIdx ? r.levels.filter((_, i) => i !== levelIdx) : [...r.levels];
    if (levels.length === 0) levels = [null];
    return { ...r, levels };
  });
}

export function applyColumn(rows: EditableRow[], levelIdx: number, value: number): EditableRow[] {
  return rows.map((r) => {
    const levels = [...r.levels];
    while (levels.length <= levelIdx) levels.push(null);
    levels[levelIdx] = value;
    return { ...r, levels };
  });
}
