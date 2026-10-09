"use client";

import { StaffFilterSelect } from "@/components/staff/staff-workspace-shell";

type Props = {
  draftBranch: string;
  draftTd: string;
  draftOblast: string;
  draftCity: string;
  onDraftBranch: (v: string) => void;
  onDraftTd: (v: string) => void;
  onDraftOblast: (v: string) => void;
  onDraftCity: (v: string) => void;
  branchOptions: string[];
  tradeDirectionOptions: string[];
  oblastOptions: string[];
  cityOptions: string[];
};

/** Eksportor filtrlari bilan bir xil oblast→город kaskadi. */
export function AgentsFiltersRow({
  draftBranch,
  draftTd,
  draftOblast,
  draftCity,
  onDraftBranch,
  onDraftTd,
  onDraftOblast,
  onDraftCity,
  branchOptions,
  tradeDirectionOptions,
  oblastOptions,
  cityOptions
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
        label="Область"
        value={draftOblast}
        onChange={(v) => {
          onDraftOblast(v);
          onDraftCity("");
        }}
        emptyLabel="Все области"
      >
        {oblastOptions.map((t) => (
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
        {cityOptions.map((t) => (
          <option key={`city-${t}`} value={t}>
            {t}
          </option>
        ))}
      </StaffFilterSelect>
    </>
  );
}
