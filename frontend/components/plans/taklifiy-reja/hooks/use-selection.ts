import { useCallback, useEffect, useMemo, useState } from "react";
import type { MultiProposalResult } from "@salec/plans-proposal";
import { canSelectCell, cellId, mergeSelection, parseCellId, type CellRef } from "@taklifiy/lib/selection";

/** Katak darajasidagi tanlov. Yashirilgan KPI yoki himoyalangan kataklar avtomatik tushadi. */
export function useSelection(visibleKpiIds: number[], result: MultiProposalResult) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allowed = useMemo(() => {
    const ids = new Set<string>();
    for (const kpi of result.kpis) {
      if (!visibleKpiIds.includes(kpi.kpiGroupId)) continue;
      for (const row of kpi.result.rows) {
        if (canSelectCell(row)) ids.add(cellId(kpi.kpiGroupId, row.key));
      }
    }
    return ids;
  }, [result, visibleKpiIds]);

  useEffect(() => {
    setSelected((old) => {
      const next = new Set([...old].filter((id) => allowed.has(id)));
      return next.size === old.size ? old : next;
    });
  }, [allowed]);

  const toggleCell = useCallback((kpiId: number, key: string) => {
    const id = cellId(kpiId, key);
    setSelected((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectIds = useCallback(
    (ids: string[], on: boolean) => setSelected((old) => mergeSelection(old, ids, on)),
    []
  );
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const selectedCells = useMemo<CellRef[]>(() => [...selected].map(parseCellId), [selected]);

  return { selected, selectedCells, toggleCell, selectIds, clearSelection };
}
