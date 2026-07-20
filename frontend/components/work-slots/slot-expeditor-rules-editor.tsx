"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { api } from "@/lib/api";
import { priceTypeOptionsFromResponse, type PriceTypeOption } from "@/lib/price-type-label";
import { STALE } from "@/lib/query-stale";
import type { ExpeditorAssignmentRules } from "@/components/staff/expeditors-workspace";

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс"
};

type Props = {
  tenant: string;
  value: ExpeditorAssignmentRules;
  onChange: (next: ExpeditorAssignmentRules) => void;
};

export function parseExpeditorAssignmentRules(raw: unknown): ExpeditorAssignmentRules {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as ExpeditorAssignmentRules;
}

/** Правила автопривязки заказов экспедитора — на уровне рабочего места. */
export function SlotExpeditorRulesEditor({ tenant, value, onChange }: Props) {
  const [ptSearch, setPtSearch] = useState("");
  const [agSearch, setAgSearch] = useState("");
  const [whSearch, setWhSearch] = useState("");
  const [tdSearch, setTdSearch] = useState("");
  const [trSearch, setTrSearch] = useState("");

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenant, "slot-expeditor-rules"],
    enabled: Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[]; options?: PriceTypeOption[] }>(
        `/api/${tenant}/price-types?kind=sale`
      );
      return priceTypeOptionsFromResponse(data);
    }
  });

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenant, "slot-expeditor-rules"],
    enabled: Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenant}/warehouses?limit=500&page=1`
      );
      return data.data;
    }
  });

  const agentsQ = useQuery({
    queryKey: ["agents", tenant, "slot-expeditor-rules-picker"],
    enabled: Boolean(tenant),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; fio: string; code: string | null }[] }>(
        `/api/${tenant}/agents?limit=500&page=1&is_active=true`
      );
      return data.data;
    }
  });

  const tradeDirectionsQ = useQuery({
    queryKey: ["trade-directions", tenant, "slot-expeditor-rules"],
    enabled: Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenant}/agents/meta/trade-directions`);
      return data.data;
    }
  });

  const territoryQ = useQuery({
    queryKey: ["territories", tenant, "slot-expeditor-rules"],
    enabled: Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenant}/agents/meta/territories`);
      return data.data;
    }
  });

  const ptSel = useMemo(() => new Set(value.price_types ?? []), [value.price_types]);
  const agSel = useMemo(() => new Set(value.agent_ids ?? []), [value.agent_ids]);
  const whSel = useMemo(() => new Set(value.warehouse_ids ?? []), [value.warehouse_ids]);
  const tdSel = useMemo(() => new Set(value.trade_directions ?? []), [value.trade_directions]);
  const trSel = useMemo(() => new Set(value.territories ?? []), [value.territories]);
  const wdSel = useMemo(() => new Set(value.weekdays ?? []), [value.weekdays]);

  const patch = (partial: Partial<ExpeditorAssignmentRules>) => onChange({ ...value, ...partial });

  const ptItems = useMemo(
    () => (priceTypesQ.data ?? []).map((p) => ({ id: p.id, title: p.label })),
    [priceTypesQ.data]
  );
  const agItems = useMemo(
    () =>
      (agentsQ.data ?? []).map((a) => ({
        id: a.id,
        title: `${a.fio}${a.code ? ` (${a.code})` : ""}`,
        searchText: `${a.code ?? ""} ${a.id}`
      })),
    [agentsQ.data]
  );
  const whItems = useMemo(
    () => (warehousesQ.data ?? []).map((w) => ({ id: w.id, title: w.name })),
    [warehousesQ.data]
  );
  const tdItems = useMemo(
    () => (tradeDirectionsQ.data ?? []).map((t) => ({ id: t, title: t })),
    [tradeDirectionsQ.data]
  );
  const trItems = useMemo(
    () => (territoryQ.data ?? []).map((t) => ({ id: t, title: t })),
    [territoryQ.data]
  );
  const weekdayItems = useMemo(
    () => ([1, 2, 3, 4, 5, 6, 7] as const).map((d) => ({ id: d, title: WEEKDAY_LABELS[d] })),
    []
  );

  return (
    <div className="space-y-4 rounded-lg border border-border/70 p-3">
      <div>
        <Label className="text-sm font-medium">Условия привязки к заявке</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Пустые блоки не учитываются. Заказ сопоставляется с типом цены, агентом, складом, направлением,
          территорией клиента и днём недели.
        </p>
      </div>

      <SearchableMultiSelectPanel<string>
        label="Типы цен"
        hideOuterLabel
        inline
        search={ptSearch}
        onSearchChange={setPtSearch}
        items={ptItems}
        selected={ptSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(ptSel) : updater;
          patch({ price_types: next.size ? Array.from(next) : undefined });
        }}
        triggerPlaceholder="Типы цен"
        searchPlaceholder="Поиск типов цен"
      />

      <SearchableMultiSelectPanel<number>
        label="Агенты заказа"
        hideOuterLabel
        inline
        search={agSearch}
        onSearchChange={setAgSearch}
        items={agItems}
        selected={agSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(agSel) : updater;
          patch({ agent_ids: next.size ? Array.from(next) : undefined });
        }}
        triggerPlaceholder="Агенты"
        searchPlaceholder="Поиск агентов"
      />

      <SearchableMultiSelectPanel<number>
        label="Склады"
        hideOuterLabel
        inline
        search={whSearch}
        onSearchChange={setWhSearch}
        items={whItems}
        selected={whSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(whSel) : updater;
          patch({ warehouse_ids: next.size ? Array.from(next) : undefined });
        }}
        triggerPlaceholder="Склады"
        searchPlaceholder="Поиск складов"
      />

      <SearchableMultiSelectPanel<string>
        label="Направления торговли"
        hideOuterLabel
        inline
        search={tdSearch}
        onSearchChange={setTdSearch}
        items={tdItems}
        selected={tdSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(tdSel) : updater;
          patch({ trade_directions: next.size ? Array.from(next) : undefined });
        }}
        triggerPlaceholder="Направления"
        searchPlaceholder="Поиск направлений"
      />

      <SearchableMultiSelectPanel<string>
        label="Территории клиента"
        hideOuterLabel
        inline
        search={trSearch}
        onSearchChange={setTrSearch}
        items={trItems}
        selected={trSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(trSel) : updater;
          patch({ territories: next.size ? Array.from(next) : undefined });
        }}
        triggerPlaceholder="Территории"
        searchPlaceholder="Поиск территорий"
      />

      <SearchableMultiSelectPanel<number>
        label="Дни недели"
        hideOuterLabel
        inline
        searchable={false}
        items={weekdayItems}
        selected={wdSel}
        onSelectedChange={(updater) => {
          const next = typeof updater === "function" ? updater(wdSel) : updater;
          const days = Array.from(next).sort((a, b) => a - b);
          patch({ weekdays: days.length ? days : undefined });
        }}
        triggerPlaceholder="Дни недели"
      />
    </div>
  );
}
