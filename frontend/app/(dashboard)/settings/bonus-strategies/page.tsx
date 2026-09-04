"use client";

import type { BonusStrategyRow } from "@/components/bonus-strategies/bonus-strategy-types";
import {
  BonusStrategyScopeDialog,
  formatBonusStrategyScopeSummary,
  type BonusStrategyScopeValue
} from "@/components/bonus-strategies/bonus-strategy-scope-dialog";
import { HistoryIconButton } from "@/components/history/history-icon-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function scopeFromRow(r: BonusStrategyRow): BonusStrategyScopeValue {
  return {
    scope_branch_codes: [...(r.scope_branch_codes ?? [])],
    scope_agent_user_ids: [...(r.scope_agent_user_ids ?? [])],
    scope_trade_direction_ids: [...(r.scope_trade_direction_ids ?? [])]
  };
}

export default function BonusStrategiesListPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useAppConfirm();
  const [scopeRow, setScopeRow] = useState<BonusStrategyRow | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["bonus-strategies", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ data: BonusStrategyRow[]; total: number }>(
        `/api/${tenantSlug}/bonus-strategies`
      );
      return data;
    }
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      const { data } = await api.patch<BonusStrategyRow>(
        `/api/${tenantSlug}/bonus-strategies/${id}/active`,
        { is_active }
      );
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bonus-strategies", tenantSlug] })
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/bonus-strategies/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bonus-strategies", tenantSlug] })
  });

  const scopeMut = useMutation({
    mutationFn: async ({ id, scope }: { id: number; scope: BonusStrategyScopeValue }) => {
      const { data } = await api.put<BonusStrategyRow>(`/api/${tenantSlug}/bonus-strategies/${id}`, scope);
      return data;
    },
    onSuccess: () => {
      setScopeError(null);
      setScopeRow(null);
      void qc.invalidateQueries({ queryKey: ["bonus-strategies", tenantSlug] });
    },
    onError: (e: unknown) => {
      setScopeError(getUserFacingError(e, "Не удалось сохранить привязку."));
    }
  });

  const rows = listQ.data?.data ?? [];

  return (
    <PageShell>
      <PageHeader
        title="Стратегия бонусов и скидок"
        description="Группа активных бонусов/скидок с лимитом выбора в заказе (агент отмечает до N штук)."
        actions={
          <Link href="/settings/bonus-strategies/new" className={cn(buttonVariants({ size: "sm" }))}>
            + Создать
          </Link>
        }
      />

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : listQ.isError ? (
        <p className="text-sm text-destructive">{getUserFacingError(listQ.error, "Ошибка")}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Пока нет стратегий. Создайте первую.</p>
          <Link
            href="/settings/bonus-strategies/new"
            className={cn(buttonVariants({ size: "sm" }), "mt-4 inline-flex")}
          >
            + Создать стратегию
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Название</th>
                <th className="px-3 py-2.5 font-medium">Правил</th>
                <th className="px-3 py-2.5 font-medium">Выбор</th>
                <th className="px-3 py-2.5 font-medium">Привязка</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-3 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const scopeSummary = formatBonusStrategyScopeSummary(scopeFromRow(r));
                return (
                  <tr key={r.id} className="border-b border-border/70 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <Link
                        href={`/settings/bonus-strategies/${r.id}`}
                        className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{r.members.length}</td>
                    <td className="px-3 py-3">до {r.max_select}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[160px] truncate text-xs text-muted-foreground" title={scopeSummary}>
                          {scopeSummary}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Филиал, агенты, направление"
                          aria-label="Привязка к заказу"
                          onClick={() => {
                            setScopeError(null);
                            setScopeRow(r);
                          }}
                        >
                          <UserRound className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {r.is_active ? (
                        <Badge variant="success">Активна</Badge>
                      ) : (
                        <Badge variant="secondary">Выкл.</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <HistoryIconButton
                          module="settings"
                          section="bonusy_i_skidki"
                          entityType="bonus_strategy"
                          entityId={r.id}
                          title={`История: ${r.name}`}
                        />
                        <Link
                          href={`/settings/bonus-strategies/${r.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                          )}
                          title="Редактировать"
                          aria-label="Редактировать"
                        >
                          <Pencil className="size-3.5" />
                          Редактировать
                        </Link>
                        <button
                          type="button"
                          className="px-1.5 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => toggleMut.mutate({ id: r.id, is_active: !r.is_active })}
                        >
                          {r.is_active ? "Выключить" : "Включить"}
                        </button>
                        <button
                          type="button"
                          className="px-1.5 text-xs text-destructive hover:underline"
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: "Удалить",
                                message: `Удалить «${r.name}»?`,
                                confirmLabel: "Да",
                                cancelLabel: "Нет",
                                destructive: true
                              });
                              if (ok) delMut.mutate(r.id);
                            })();
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tenantSlug && scopeRow ? (
        <BonusStrategyScopeDialog
          key={scopeRow.id}
          open
          onOpenChange={(o) => {
            if (!o) {
              setScopeRow(null);
              setScopeError(null);
            }
          }}
          tenantSlug={tenantSlug}
          title={`Привязка: ${scopeRow.name}`}
          value={scopeFromRow(scopeRow)}
          saving={scopeMut.isPending}
          error={scopeError}
          onApply={(next) => {
            setScopeError(null);
            scopeMut.mutate({ id: scopeRow.id, scope: next });
          }}
        />
      ) : null}
      {confirmDialog}
    </PageShell>
  );
}
