"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, MapPin, Pencil, Plus, Route, Search, Users, Warehouse, Wallet, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessUnsavedBar, useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { countIdDelta, sameIdSet, TerritoryScopeTree } from "./access-user-scope-territory";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { accessRoleLabel } from "@/lib/access-role-label";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";
import {
  userMessageAfterAccessPatchFailure,
  type DetailModalKind,
  type DimRow,
  type TerritoryApiRow
} from "./access-user-detail.types";
import type { AccessUserDetailTab } from "./access-user-detail-header";

type ScopeTab = Extract<AccessUserDetailTab, "territories" | "branches" | "cash_desks" | "payment_methods" | "warehouses" | "trade_directions" | "staff">;

const SCOPE_META: Record<ScopeTab, { modal: DetailModalKind; icon: LucideIcon; hint: string; empty: string }> = {
  territories: {
    modal: "territory",
    icon: MapPin,
    hint: "Клиенты и заказы каких территорий видит пользователь.",
    empty: "Территории не прикреплены — ограничение по территориям не действует."
  },
  staff: {
    modal: "staff",
    icon: Users,
    hint: "Сотрудники (агенты, экспедиторы и др.), данные которых видит пользователь.",
    empty: "Сотрудники не прикреплены."
  },
  cash_desks: { modal: "cash", icon: Wallet, hint: "С какими кассами пользователь может работать.", empty: "Кассы не прикреплены." },
  warehouses: { modal: "warehouse", icon: Warehouse, hint: "С какими складами пользователь может работать.", empty: "Склады не прикреплены." },
  branches: { modal: "branch", icon: Building2, hint: "В каких филиалах пользователь может работать.", empty: "Филиалы не прикреплены." },
  payment_methods: { modal: "payment", icon: CreditCard, hint: "Какие способы оплаты доступны пользователю.", empty: "Способы оплаты не прикреплены." },
  trade_directions: { modal: "direction", icon: Route, hint: "Направления торговли, доступные пользователю.", empty: "Направления не прикреплены." }
};

export function isAccessScopeTab(tab: AccessUserDetailTab): tab is ScopeTab {
  return tab in SCOPE_META;
}

type Item = { id: string; label: string; sub?: string };

function useScopeLabels(tenantSlug: string, tab: ScopeTab) {
  const dimType = tab === "territories" || tab === "staff" ? null : tab;
  const territoriesQ = useQuery({
    queryKey: ["access-scope-territory-names", tenantSlug],
    enabled: tab === "territories",
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data?: TerritoryApiRow[] }>(`/api/${tenantSlug}/access/territories`);
      return new Map((data.data ?? []).map((r) => [String(r.id), r.label || r.name] as const));
    }
  });
  const dimQ = useQuery({
    queryKey: ["access-scope-dim-names", tenantSlug, dimType],
    enabled: dimType != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: DimRow[] }>(`/api/${tenantSlug}/access/dimensions?type=${dimType}`);
      return new Map((data.data ?? []).map((r) => [String(r.key), r.label] as const));
    }
  });
  return tab === "territories" ? territoriesQ : dimQ;
}

function scopeSaveBody(tab: Exclude<ScopeTab, "territories">, ids: string[]): Record<string, unknown> {
  const nums = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (tab === "staff") return { supervisee_user_ids: nums };
  if (tab === "cash_desks") return { cash_desk_ids: nums };
  if (tab === "warehouses") return { warehouse_ids: nums };
  if (tab === "branches") return { branch_codes: ids.map((x) => x.trim()).filter(Boolean) };
  if (tab === "payment_methods") return { payment_methods: ids.map((x) => x.trim()).filter(Boolean) };
  return { trade_direction_ids: nums };
}

/** Hudud tablari: biriktirilgan obyektlar nomi bilan + tanlash oynasini ochish. */
export function AccessUserScopeSummary({ vm, tab, readOnly }: { vm: AccessUserDetailVm; tab: ScopeTab; readOnly: boolean }) {
  const meta = SCOPE_META[tab];
  const Icon = meta.icon;
  const detail = vm.detailQ.data;
  const labelsQ = useScopeLabels(vm.tenantSlug, tab);
  const [search, setSearch] = useState("");

  const items = useMemo((): Item[] => {
    if (tab === "staff") {
      return (detail?.supervisees ?? []).map((s) => ({
        id: String(s.id),
        label: `${s.code ? `[${s.code}] ` : ""}${s.name || s.login}`,
        sub: accessRoleLabel(s.role)
      }));
    }
    const scope = detail?.scope;
    const ids: (string | number)[] =
      tab === "territories"
        ? scope?.territories ?? []
        : tab === "branches"
          ? scope?.branches ?? []
          : tab === "cash_desks"
            ? scope?.cash_desks ?? []
            : tab === "payment_methods"
              ? scope?.payment_methods ?? []
              : tab === "warehouses"
                ? scope?.warehouses ?? []
                : scope?.trade_directions ?? [];
    const names = labelsQ.data;
    return ids
      .map((raw) => {
        const id = String(raw);
        return { id, label: names?.get(id) ?? (typeof raw === "number" ? `#${id}` : id) };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [tab, detail, labelsQ.data]);

  const q = search.trim().toLocaleLowerCase("ru");
  const shown = q ? items.filter((i) => i.label.toLocaleLowerCase("ru").includes(q) || i.sub?.toLocaleLowerCase("ru").includes(q)) : items;
  const loadingNames = tab !== "staff" && items.length > 0 && labelsQ.isLoading;
  const serverIds = useMemo(() => items.map((i) => i.id), [items]);
  const serverKey = serverIds.join("\n");
  const serverSet = useMemo(() => new Set(serverIds), [serverIds]);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const toast = useAccessToast();
  useEffect(() => {
    setDraft(null);
  }, [serverKey]);
  const kept = draft ?? serverSet;
  const listDirty = draft != null && !sameIdSet(draft, serverSet);
  const listDelta = countIdDelta(serverSet, kept);

  if (tab === "territories") return <TerritoryScopeTree vm={vm} readOnly={readOnly} hint={meta.hint} />;

  const setChecked = (id: string, on: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev ?? serverIds);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const saveList = async () => {
    try {
      await vm.patchMut.mutateAsync(scopeSaveBody(tab, [...kept]));
      toast.show({ tone: "ok", text: "Сохранено" });
    } catch (err) {
      toast.show({
        tone: "err",
        text: "Не удалось сохранить",
        detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.")
      });
    }
  };
  const shownIds = shown.map((i) => i.id);
  const allShownOn = shownIds.length > 0 && shownIds.every((id) => kept.has(id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="h-8 pl-8 text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
        </div>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 bg-teal-700 text-xs text-white hover:bg-teal-800"
            disabled={listDirty}
            title={listDirty ? "Сначала сохраните или отмените изменения" : undefined}
            onClick={() => vm.openModal(meta.modal)}
          >
            {items.length > 0 ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {items.length > 0 ? "Изменить" : "Прикрепить"}
          </Button>
        ) : null}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        {meta.hint} Снимите галочку или нажмите «Убрать», затем «Сохранить».
        {items.length > 0 ? (
          <>
            {" "}
            Прикреплено: <b className="tabular-nums text-foreground">{kept.size}</b>
          </>
        ) : null}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {loadingNames ? (
          <div className="space-y-1.5" aria-busy="true">
            {Array.from({ length: Math.min(items.length, 6) }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
            </span>
            <p className="max-w-sm text-sm font-medium text-muted-foreground">{meta.empty}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border/70">
            {!readOnly && shownIds.length > 1 ? (
              <li className="flex items-center gap-3 bg-muted/40 px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-700"
                  checked={allShownOn}
                  disabled={vm.patchMut.isPending}
                  aria-label="Отметить все видимые"
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDraft((prev) => {
                      const next = new Set(prev ?? serverIds);
                      for (const id of shownIds) {
                        if (on) next.add(id);
                        else next.delete(id);
                      }
                      return next;
                    });
                  }}
                />
                <span className="font-medium text-muted-foreground">Все видимые</span>
              </li>
            ) : null}
            {shown.map((i) => {
              const on = kept.has(i.id);
              return (
                <li
                  key={i.id}
                  className={cn(
                    "flex min-w-0 items-center gap-3 px-3 py-2.5 text-sm",
                    on ? "bg-card" : "bg-rose-50/80 text-muted-foreground dark:bg-rose-950/30"
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-teal-700"
                    checked={on}
                    disabled={readOnly || vm.patchMut.isPending}
                    aria-label={on ? `Оставить ${i.label}` : `Вернуть ${i.label}`}
                    onChange={(e) => setChecked(i.id, e.target.checked)}
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className={cn("min-w-0 flex-1 truncate", !on && "line-through")} title={i.label}>
                    {i.label}
                  </span>
                  {i.sub ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{i.sub}</span>
                  ) : null}
                  {!on ? <span className="shrink-0 text-[11px] text-rose-700">будет убрано</span> : null}
                  {!readOnly && on ? (
                    <button
                      type="button"
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:hover:bg-rose-950"
                      disabled={vm.patchMut.isPending}
                      aria-label={`Убрать ${i.label}`}
                      onClick={() => setChecked(i.id, false)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      Убрать
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {listDirty && !readOnly ? (
        <AccessUnsavedBar
          added={listDelta.added}
          removed={listDelta.removed}
          pending={vm.patchMut.isPending}
          onCancel={() => setDraft(null)}
          onSave={() => void saveList()}
        />
      ) : null}
      {toast.node}
    </div>
  );
}
