"use client";

import { StaffFilterSelect } from "@/components/staff/staff-workspace-shell";

type Props = {
  draftBranch: string;
  draftPos: string;
  draftTd: string;
  onDraftBranch: (v: string) => void;
  onDraftPos: (v: string) => void;
  onDraftTd: (v: string) => void;
  branchOptions: string[];
  positionOptions: string[];
  tradeDirectionOptions: string[];
};

export function AgentsFiltersRow({
  draftBranch,
  draftPos,
  draftTd,
  onDraftBranch,
  onDraftPos,
  onDraftTd,
  branchOptions,
  positionOptions,
  tradeDirectionOptions
}: Props) {
  return (
    <>
      <StaffFilterSelect
        label="Филиалы"
        value={draftBranch}
        onChange={onDraftBranch}
        emptyLabel="Все филиалы"
      >
        {branchOptions.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </StaffFilterSelect>
      <StaffFilterSelect
        label="Направление торговли"
        value={draftTd}
        onChange={onDraftTd}
        emptyLabel="Все направления"
      >
        {tradeDirectionOptions.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </StaffFilterSelect>
      <StaffFilterSelect
        label="Должность"
        value={draftPos}
        onChange={onDraftPos}
        emptyLabel="Все должности"
      >
        {positionOptions.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </StaffFilterSelect>
    </>
  );
}
