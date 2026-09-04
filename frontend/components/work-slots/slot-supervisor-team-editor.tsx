"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import type { WorkSlotListItem } from "@/lib/work-slots-types";

type Props = {
  tenant: string;
  value: number[];
  onChange: (next: number[]) => void;
};

/** SVR jamoa: agent ishchi o‘rinlarini tanlash. */
export function SlotSupervisorTeamEditor({ tenant, value, onChange }: Props) {
  const [search, setSearch] = useState("");

  const agentSlotsQ = useQuery({
    queryKey: ["work-slots", tenant, "agent-team-picker"],
    enabled: Boolean(tenant),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: WorkSlotListItem[]; total: number }>(
        `/api/${tenant}/work-slots?slot_types=agent&is_active=true&limit=500&page=1`
      );
      return data.data ?? [];
    }
  });

  const items = useMemo(() => {
    const rows = agentSlotsQ.data ?? [];
    const q = search.trim().toLowerCase();
    return rows
      .filter((s) => {
        if (!q) return true;
        const hay = [s.slot_code, s.label, s.active_user_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .map((s) => ({
        id: s.id,
        title: s.label?.trim() || s.slot_code,
        subtitle: [
          s.slot_code,
          s.active_user_name?.trim() || "вакантно"
        ].join(" · ")
      }));
  }, [agentSlotsQ.data, search]);

  const selected = useMemo(() => new Set(value), [value]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Выберите рабочие места агентов. У активного сотрудника на месте будет установлен этот
        супервайзер.
      </p>
      <SearchableMultiSelectPanel
        label="Агенты (рабочие места)"
        searchPlaceholder="Код, название или сотрудник"
        search={search}
        onSearchChange={setSearch}
        items={items}
        selected={selected}
        onSelectedChange={(next) => {
          const ids = typeof next === "function" ? next(selected) : next;
          onChange(Array.from(ids));
        }}
        emptyMessage={agentSlotsQ.isLoading ? "Загрузка…" : "Нет активных мест агентов"}
        triggerClassName="h-[42px] w-full rounded-lg border border-border bg-card px-3 text-sm"
      />
    </div>
  );
}
