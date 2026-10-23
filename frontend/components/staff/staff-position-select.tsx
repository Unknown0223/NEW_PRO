"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { positionCatalogRoleLabel } from "@/lib/position-catalog-roles";
import { cn } from "@/lib/utils";

export type PositionPresetOption = {
  id: string;
  label: string;
  role: string | null;
  code: string | null;
  is_active: boolean;
  sort_order: number;
};

type FilterOptionsPayload = {
  branches: string[];
  positions: string[];
  position_presets: string[];
  position_preset_rows?: PositionPresetOption[];
};

type Props = {
  tenantSlug: string;
  value: string;
  onChange: (label: string) => void;
  /** Agar berilsa — shu rol + rol bog‘lanmagan shablonlar */
  roleFilter?: string | null;
  id?: string;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

export function usePositionPresetOptions(tenantSlug: string) {
  return useQuery({
    queryKey: ["operators", tenantSlug, "filter-options"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FilterOptionsPayload }>(
        `/api/${tenantSlug}/operators/meta/filter-options`
      );
      return data.data;
    }
  });
}

/** Lavozim tanlash — katalogdan (rol bo‘yicha filtrlash mumkin). */
export function StaffPositionSelect({
  tenantSlug,
  value,
  onChange,
  roleFilter,
  id,
  className,
  disabled,
  allowEmpty = true,
  emptyLabel = "— Не выбрано —"
}: Props) {
  const q = usePositionPresetOptions(tenantSlug);
  const options = useMemo(() => {
    const rows = q.data?.position_preset_rows;
    let list: PositionPresetOption[];
    if (rows?.length) {
      const active = rows.filter((r) => r.is_active !== false);
      if (!roleFilter?.trim()) {
        list = active;
      } else {
        const r = roleFilter.trim();
        const matched = active.filter((p) => p.role === r);
        const unscoped = active.filter((p) => p.role == null);
        list = [...matched, ...unscoped];
      }
    } else {
      // Orqaga mos: faqat label massivi
      list = (q.data?.position_presets ?? q.data?.positions ?? []).map((label, i) => ({
        id: `legacy-${i}`,
        label,
        role: null as string | null,
        code: null as string | null,
        is_active: true,
        sort_order: i
      }));
    }
    // Tahrirlash: katalogda yo‘q eski qiymatni saqlab qolish
    const cur = value.trim();
    if (cur && !list.some((o) => o.label === cur)) {
      list = [
        {
          id: `current-${cur}`,
          label: cur,
          role: null,
          code: null,
          is_active: true,
          sort_order: -1
        },
        ...list
      ];
    }
    return list;
  }, [q.data, roleFilter, value]);

  return (
    <select
      id={id}
      disabled={disabled || q.isLoading}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
        className
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.id} value={o.label}>
          {o.label}
          {o.role ? ` (${positionCatalogRoleLabel(o.role)})` : ""}
          {o.code ? ` [${o.code}]` : ""}
        </option>
      ))}
    </select>
  );
}
