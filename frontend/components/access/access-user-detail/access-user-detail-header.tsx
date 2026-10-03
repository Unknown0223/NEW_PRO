"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { treeKeys } from "@/lib/access-operations-tree";
import { accessRoleLabel } from "@/lib/access-role-label";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export type AccessUserDetailTab =
  | "operations"
  | "territories"
  | "branches"
  | "cash_desks"
  | "payment_methods"
  | "warehouses"
  | "trade_directions"
  | "staff"
  | "delegation"
  | "history";

export const ACCESS_USER_DETAIL_TABS: { id: AccessUserDetailTab; label: string }[] = [
  { id: "operations", label: "Операции" },
  { id: "territories", label: "Территории" },
  { id: "branches", label: "Филиалы" },
  { id: "cash_desks", label: "Кассы" },
  { id: "payment_methods", label: "Способы оплаты" },
  { id: "warehouses", label: "Склады" },
  { id: "trade_directions", label: "Направления" },
  { id: "staff", label: "Сотрудники" },
  { id: "delegation", label: "Делегирование" },
  { id: "history", label: "История" }
];

export function AccessUserDetailHeader({
  vm,
  tab,
  onTab,
  onBack
}: {
  vm: AccessUserDetailVm;
  tab: AccessUserDetailTab;
  onTab: (t: AccessUserDetailTab) => void;
  onBack?: () => void;
}) {
  const user = vm.user!;
  const controls = vm.userAccountControls;
  const treeQ = useAccessOperationsTree(vm.tenantSlug);
  const matrix = vm.detailQ.data?.matrix;
  const opsCount = useMemo(() => {
    if (!treeQ.data || !matrix) return null;
    const eff = new Set(matrix.filter((r) => r.effective).map((r) => r.key));
    return treeKeys(treeQ.data).filter((k) => eff.has(k)).length;
  }, [treeQ.data, matrix]);
  const active = user.status === "active";

  return (
    <div className="shrink-0 border-b border-border/60 bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div className="flex min-w-0 items-start gap-2">
          {onBack ? (
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={onBack} aria-label="Назад к списку пользователей">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold leading-tight">
              {user.code ? `[${user.code}] ` : ""}
              {user.full_name || user.login}
            </h2>
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex gap-1">
                <dt>Логин:</dt>
                <dd className="font-medium text-foreground">{user.login}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Роль:</dt>
                <dd className="font-medium text-foreground">{accessRoleLabel(user.role)}</dd>
              </div>
              <div className="flex gap-1">
                <dt>Операций:</dt>
                <dd className="font-medium tabular-nums text-foreground">{opsCount ?? "…"}</dd>
              </div>
              <div className="flex items-center gap-1">
                <dt className="sr-only">Статус</dt>
                <dd>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                    )}
                  >
                    {active ? "Активный" : "Неактивный"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        {controls ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              disabled={controls.resetPending}
              onClick={() => void controls.onReset(user.id)}
              title="Сбросить персональные права к роли по умолчанию"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Сбросить к роли
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("h-8 text-xs text-white", active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")}
              disabled={controls.togglePending}
              onClick={controls.onToggle}
            >
              {active ? "Деактивировать" : "Активировать"}
            </Button>
          </div>
        ) : null}
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2" role="tablist" aria-label="Разделы доступа пользователя">
        {ACCESS_USER_DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            data-active={tab === t.id}
            className={cn("access-tab-chip shrink-0 text-xs", tab === t.id ? "" : "text-muted-foreground hover:bg-muted/50")}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
