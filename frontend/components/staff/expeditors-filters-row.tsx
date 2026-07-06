"use client";

import { StaffFilterSelect } from "@/components/staff/staff-workspace-shell";

type Props = {
  draftBranch: string;
  draftPos: string;
  draftTd: string;
  draftOblast: string;
  draftCity: string;
  onDraftBranch: (v: string) => void;
  onDraftPos: (v: string) => void;
  onDraftTd: (v: string) => void;
  onDraftOblast: (v: string) => void;
  onDraftCity: (v: string) => void;
  branchOptions: string[];
  positionOptions: string[];
  tradeDirectionOptions: string[];
  territoryTokenOptions: string[];
};

/** Agent `AgentFilterSelect` ko‘rinishi — ekspektor filtrlari (API parametrlari o‘zgarmaydi). */
export function ExpeditorsFiltersRow({
  draftBranch,
  draftPos,
  draftTd,
  draftOblast,
  draftCity,
  onDraftBranch,
  onDraftPos,
  onDraftTd,
  onDraftOblast,
  onDraftCity,
  branchOptions,
  positionOptions,
  tradeDirectionOptions,
  territoryTokenOptions
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
      <StaffFilterSelect
        label="Область"
        value={draftOblast}
        onChange={onDraftOblast}
        emptyLabel="Все области"
      >
        {territoryTokenOptions.map((t) => (
          <option key={`obl-${t}`} value={t}>
            {t}
          </option>
        ))}
      </StaffFilterSelect>
      <StaffFilterSelect
        label="Город"
        value={draftCity}
        onChange={onDraftCity}
        emptyLabel="Все города"
      >
        {territoryTokenOptions.map((t) => (
          <option key={`city-${t}`} value={t}>
            {t}
          </option>
        ))}
      </StaffFilterSelect>
    </>
  );
}
