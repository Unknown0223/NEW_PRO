"use client";

import { Button } from "@/components/ui/button";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";
import type { DetailModalKind } from "./access-user-detail.types";
import type { AccessUserDetailTab } from "./access-user-detail-header";

type ScopeTab = Exclude<AccessUserDetailTab, "operations" | "delegation" | "history">;

const SCOPE_META: Record<ScopeTab, { modal: DetailModalKind; title: string; hint: string; empty: string }> = {
  territories: {
    modal: "territory",
    title: "Территории",
    hint: "Клиенты и заказы каких территорий видит пользователь.",
    empty: "Территории не прикреплены — ограничение по территориям не действует."
  },
  branches: {
    modal: "branch",
    title: "Филиалы",
    hint: "В каких филиалах пользователь может работать.",
    empty: "Филиалы не прикреплены."
  },
  cash_desks: {
    modal: "cash",
    title: "Кассы",
    hint: "С какими кассами пользователь может работать.",
    empty: "Кассы не прикреплены."
  },
  payment_methods: {
    modal: "payment",
    title: "Способы оплаты",
    hint: "Какие способы оплаты доступны пользователю.",
    empty: "Способы оплаты не прикреплены."
  },
  warehouses: {
    modal: "warehouse",
    title: "Склады",
    hint: "С какими складами пользователь может работать.",
    empty: "Склады не прикреплены."
  },
  trade_directions: {
    modal: "direction",
    title: "Направления",
    hint: "Направления торговли, доступные пользователю.",
    empty: "Направления не прикреплены."
  },
  staff: {
    modal: "staff",
    title: "Сотрудники",
    hint: "Сотрудники (агенты, экспедиторы и др.), данные которых видит пользователь.",
    empty: "Сотрудники не прикреплены."
  }
};

export function isAccessScopeTab(tab: AccessUserDetailTab): tab is ScopeTab {
  return tab in SCOPE_META;
}

/** Hudud tablari: biriktirilganlar soni + mavjud tanlash oynasini ochish. */
export function AccessUserScopeSummary({ vm, tab, readOnly }: { vm: AccessUserDetailVm; tab: ScopeTab; readOnly: boolean }) {
  const meta = SCOPE_META[tab];
  const detail = vm.detailQ.data;
  const scope = detail?.scope;
  const count =
    tab === "staff"
      ? (detail?.supervisees ?? []).length
      : tab === "territories"
        ? (scope?.territories ?? []).length
        : tab === "branches"
          ? (scope?.branches ?? []).length
          : tab === "cash_desks"
            ? (scope?.cash_desks ?? []).length
            : tab === "payment_methods"
              ? (scope?.payment_methods ?? []).length
              : tab === "warehouses"
                ? (scope?.warehouses ?? []).length
                : (scope?.trade_directions ?? []).length;

  return (
    <section className="rounded-lg border border-border/60 bg-card p-4" aria-labelledby={`scope-${tab}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`scope-${tab}-title`} className="text-sm font-semibold">
            {meta.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
          <p className="mt-3 text-sm">
            {count > 0 ? (
              <>
                Прикреплено: <b className="tabular-nums">{count}</b>
              </>
            ) : (
              <span className="text-muted-foreground">{meta.empty}</span>
            )}
          </p>
          {tab === "staff" && count > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {(detail?.supervisees ?? []).slice(0, 30).map((s) => (
                <li key={s.id} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
                  {s.code ? `[${s.code}] ` : ""}
                  {s.name || s.login}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!readOnly ? (
          <Button type="button" size="sm" className="bg-teal-700 text-white hover:bg-teal-800" onClick={() => vm.openModal(meta.modal)}>
            {count > 0 ? "Изменить" : "Прикрепить"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
