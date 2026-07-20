"use client";

import { useMemo, useState } from "react";
import type { PivotFilter } from "@salec/pivot-engine";
import { getPivotStrings } from "@salec/pivot-engine";
import { Input } from "@/components/ui/input";
import { formatPivotMemberLabel } from "@/lib/pivot-member-labels";
import { DemoApplyButton, DemoCancelButton } from "@/components/reports/demo-dialog-actions";
import { FILTER_PANEL as C } from "./filter-panel-chrome";

type Props = {
  fieldId: string;
  fieldLabel: string;
  members: (string | number)[];
  filter?: PivotFilter;
  onApply: (filter: PivotFilter | null) => void;
  onClose: () => void;
  onTopN?: () => void;
};

/**
 * Member filter panel — WDR/demo chrome, centered host provides backdrop.
 */
export function MultiSelectFilter({
  fieldId,
  fieldLabel,
  members,
  filter,
  onApply,
  onClose,
  onTopN
}: Props) {
  const f = getPivotStrings().filters;
  const [search, setSearch] = useState("");
  const initial = useMemo(() => {
    if (
      (filter?.type === "include" || filter?.type === "exclude") &&
      filter.values &&
      filter.values.length > 0
    ) {
      return new Set(filter.values.map(String));
    }
    return new Set(members.map(String));
  }, [filter?.type, filter?.values, members]);
  const [selected, setSelected] = useState<Set<string>>(initial);
  const mode: "include" | "exclude" = filter?.type === "exclude" ? "exclude" : "include";

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const code = String(m).toLowerCase();
      const label = formatPivotMemberLabel(fieldId, m).toLowerCase();
      return code.includes(q) || label.includes(q);
    });
  }, [members, search, fieldId]);

  const selectedCount = selected.size;
  const totalCount = members.length;
  const allFilteredSelected =
    filteredMembers.length > 0 && filteredMembers.every((m) => selected.has(String(m)));

  const filterByValuesLabel = f.filterByValues ?? "Фильтр по значениям";
  const selectAllLabel = f.selectAll ?? "Выделить все";
  const selectedOfTotalLabel =
    typeof f.selectedOfTotal === "function"
      ? f.selectedOfTotal(selectedCount, totalCount)
      : `${selectedCount} из ${totalCount} выбрано`;

  function toggle(value: string | number) {
    const key = String(value);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of filteredMembers) {
        const key = String(m);
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function handleApply() {
    if (selected.size === 0) {
      onApply(null);
      onClose();
      return;
    }
    if (mode === "include" && selected.size === members.length) {
      onApply(null);
      onClose();
      return;
    }
    const values = members.filter((m) => selected.has(String(m)));
    onApply({ fieldId: filter?.fieldId ?? fieldId, type: mode, values });
    onClose();
  }

  return (
    <div
      className="w-[320px] overflow-hidden rounded-sm shadow-xl"
      style={{
        background: C.bg,
        color: C.text,
        border: `1px solid ${C.border}`
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.headerBg }}
      >
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{fieldLabel}</div>
        <DemoApplyButton onClick={handleApply}>{f.apply}</DemoApplyButton>
        <DemoCancelButton onClick={onClose}>{f.cancel}</DemoCancelButton>
      </div>

      <div className="space-y-2.5 px-3 py-3" style={{ background: C.bg }}>
        <p className="text-[11px] font-medium" style={{ color: C.muted }}>
          {filterByValuesLabel}
        </p>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={f.search}
          className="h-8 rounded-sm text-xs"
          style={{ borderColor: C.border, background: C.bg, color: C.text }}
        />

        <p className="text-[11px]" style={{ color: C.muted }}>
          {selectedOfTotalLabel}
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: C.text }}>
          <input
            type="checkbox"
            checked={allFilteredSelected}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded-sm"
          />
          {selectAllLabel}
        </label>

        <div
          className="max-h-[220px] space-y-0 overflow-y-auto py-0.5"
          style={{ border: `1px solid ${C.border}`, background: C.listBg, borderRadius: 2 }}
        >
          {filteredMembers.map((m) => {
            const key = String(m);
            const checked = selected.has(key);
            const display = formatPivotMemberLabel(fieldId, m);
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs hover:bg-[#f0f0f0]"
                style={{
                  color: C.text,
                  background: checked ? C.selected : undefined,
                  borderBottom: `1px solid ${C.borderSoft}`
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(m)}
                  className="h-3.5 w-3.5 rounded-sm"
                />
                <span className="min-w-0 truncate">{display || "(пусто)"}</span>
              </label>
            );
          })}
          {filteredMembers.length === 0 && (
            <p className="px-2 py-3 text-center text-[11px]" style={{ color: C.muted }}>
              {f.noOptions}
            </p>
          )}
        </div>

        {onTopN ? (
          <button
            type="button"
            className="text-[11px] underline-offset-2 hover:underline"
            style={{ color: C.muted }}
            onClick={onTopN}
          >
            {f.topN}
          </button>
        ) : null}
      </div>
    </div>
  );
}
