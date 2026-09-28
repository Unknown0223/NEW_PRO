"use client";

import type { BonusRuleLite, BonusStrategyRow } from "@/components/bonus-strategies/bonus-strategy-types";
import {
  BonusStrategyScopeDialog,
  formatBonusStrategyScopeSummary,
  type BonusStrategyScopeValue
} from "@/components/bonus-strategies/bonus-strategy-scope-dialog";
import {
  BonusRuleFloatingInput,
  BonusRuleSection,
  BonusRuleSectionTitle
} from "@/components/bonus-rules/bonus-rule-form-fields";
import { HistoryIconButton } from "@/components/history/history-icon-button";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  initial?: BonusStrategyRow | null;
};

function emptyScope(): BonusStrategyScopeValue {
  return {
    scope_branch_codes: [],
    scope_agent_user_ids: [],
    scope_trade_direction_ids: []
  };
}

function isDiscountRule(r: BonusRuleLite) {
  return (
    r.type === "discount" || (r.type === "sum" && r.discount_pct != null && Number(r.discount_pct) > 0)
  );
}

export function BonusStrategyForm({ initial }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = initial != null && initial.id > 0;

  const [name, setName] = useState(initial?.name ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [maxSelect, setMaxSelect] = useState(String(initial?.max_select ?? 1));
  const [selectedIds, setSelectedIds] = useState<number[]>(
    () => initial?.members.map((m) => m.bonus_rule_id) ?? []
  );
  const [scope, setScope] = useState<BonusStrategyScopeValue>(() =>
    initial
      ? {
          scope_branch_codes: [...(initial.scope_branch_codes ?? [])],
          scope_agent_user_ids: [...(initial.scope_agent_user_ids ?? [])],
          scope_trade_direction_ids: [...(initial.scope_trade_direction_ids ?? [])]
        }
      : emptyScope()
  );
  const [scopeOpen, setScopeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const rulesQ = useQuery({
    queryKey: ["bonus-rules", "for-strategy", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ data: BonusRuleLite[] }>(`/api/${tenantSlug}/bonus-rules`, {
        params: { limit: 500 }
      });
      return data.data ?? [];
    }
  });

  const allRules = useMemo(() => {
    const byId = new Map<number, BonusRuleLite>();
    for (const r of rulesQ.data ?? []) byId.set(r.id, r);
    // Keep members visible while editing even if the rule list payload is incomplete.
    for (const m of initial?.members ?? []) {
      if (byId.has(m.bonus_rule_id)) continue;
      byId.set(m.bonus_rule_id, {
        id: m.bonus_rule_id,
        name: m.rule_name?.trim() || `Правило #${m.bonus_rule_id}`,
        type: m.rule_type ?? "qty",
        is_active: m.rule_is_active ?? false
      });
    }
    return Array.from(byId.values());
  }, [rulesQ.data, initial?.members]);

  const bonusRules = useMemo(() => {
    const active = allRules.filter((r) => r.is_active !== false && !isDiscountRule(r));
    const selectedInactive = allRules.filter(
      (r) => r.is_active === false && !isDiscountRule(r) && selectedIds.includes(r.id)
    );
    return [...active, ...selectedInactive];
  }, [allRules, selectedIds]);

  const discountRules = useMemo(() => {
    const active = allRules.filter((r) => r.is_active !== false && isDiscountRule(r));
    const selectedInactive = allRules.filter(
      (r) => r.is_active === false && isDiscountRule(r) && selectedIds.includes(r.id)
    );
    return [...active, ...selectedInactive];
  }, [allRules, selectedIds]);

  const memberCount = selectedIds.length;
  const maxAllowed = Math.max(1, memberCount - 1);

  useEffect(() => {
    const n = Number.parseInt(maxSelect, 10);
    if (memberCount >= 2 && Number.isFinite(n) && n > maxAllowed) {
      setMaxSelect(String(maxAllowed));
    }
  }, [memberCount, maxAllowed, maxSelect]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("name");
      if (selectedIds.length < 2) throw new Error("members");
      const ms = Number.parseInt(maxSelect, 10);
      if (!Number.isFinite(ms) || ms < 1) throw new Error("max");
      if (ms > selectedIds.length - 1) throw new Error("maxhigh");

      const payload = {
        name: name.trim(),
        is_active: isActive,
        max_select: ms,
        scope_branch_codes: scope.scope_branch_codes,
        scope_agent_user_ids: scope.scope_agent_user_ids,
        scope_trade_direction_ids: scope.scope_trade_direction_ids,
        members: selectedIds.map((bonus_rule_id, i) => ({ bonus_rule_id, sort_order: i }))
      };

      if (isEdit) {
        const { data } = await api.put<BonusStrategyRow>(
          `/api/${tenantSlug}/bonus-strategies/${initial!.id}`,
          payload
        );
        return data;
      }
      const { data } = await api.post<BonusStrategyRow>(`/api/${tenantSlug}/bonus-strategies`, payload);
      return data;
    },
    onSuccess: (row) => {
      setSavedOk(true);
      void qc.invalidateQueries({ queryKey: ["bonus-strategies", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["bonus-strategies", tenantSlug, row.id] });
      if (isEdit) {
        router.push("/settings/bonus-strategies");
        return;
      }
      router.push(`/settings/bonus-strategies/${row.id}`);
    },
    onError: (e: unknown) => {
      if (e instanceof Error) {
        if (e.message === "name") return setError("Название обязательно.");
        if (e.message === "members") return setError("Выберите минимум 2 правила (бонус и/или скидка).");
        if (e.message === "max") return setError("Условие выбора: минимум 1.");
        if (e.message === "maxhigh") {
          return setError(`Можно выбрать не больше ${selectedIds.length - 1} (не все сразу).`);
        }
      }
      setError(getUserFacingError(e, "Ошибка сохранения"));
    }
  });

  const renderRuleList = (title: string, rows: BonusRuleLite[], emptyHint: string) => (
    <div className="rounded-xl border border-border/70 bg-background/60">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground">
          {rows.filter((r) => selectedIds.includes(r.id)).length}/{rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="max-h-72 overflow-y-auto">
          {rows.map((r) => {
            const checked = selectedIds.includes(r.id);
            const inactive = r.is_active === false;
            return (
              <li key={r.id} className="border-t border-border/40 first:border-0">
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors",
                    checked ? "bg-primary/5" : "hover:bg-muted/40",
                    inactive && "opacity-70"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={checked}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium leading-snug">{r.name}</span>
                      {inactive ? <Badge variant="secondary">Выкл.</Badge> : null}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">#{r.id}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const scopeSummary = formatBonusStrategyScopeSummary(scope);
  const hasScopeLimits =
    scope.scope_branch_codes.length > 0 ||
    scope.scope_agent_user_ids.length > 0 ||
    scope.scope_trade_direction_ids.length > 0;

  return (
    <PageShell>
      <Link
        href="/settings/bonus-strategies"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "h-8 w-fit -ml-2 text-muted-foreground"
        )}
      >
        ← К списку стратегий
      </Link>
      <PageHeader
        title={isEdit ? "Редактирование стратегии" : "Новая стратегия"}
        description="Отметьте активные бонусы и скидки, задайте сколько из них агент может применить в одном заказе."
        actions={
          isEdit && initial ? (
            <HistoryIconButton
              module="settings"
              section="bonusy_i_skidki"
              entityType="bonus_strategy"
              entityId={initial.id}
              title={`История: ${initial.name}`}
              label="История"
              size="sm"
              variant="outline"
            />
          ) : undefined
        }
      />

      <div className="flex w-full flex-col gap-4 pb-8">
        <BonusRuleSection>
          <BonusRuleSectionTitle>Основные</BonusRuleSectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <BonusRuleFloatingInput
              label="Название"
              id="bs-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Акции недели"
            />
            <BonusRuleFloatingInput
              label="Сколько можно выбрать"
              id="bs-max"
              type="number"
              min={1}
              max={maxAllowed}
              value={maxSelect}
              onChange={(e) => setMaxSelect(e.target.value)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            По умолчанию 1. Максимум {memberCount >= 2 ? maxAllowed : "—"} (на 1 меньше числа отмеченных).
          </p>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Активна
            {isActive ? (
              <Badge variant="success" className="ml-1">
                Вкл.
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-1">
                Выкл.
              </Badge>
            )}
          </label>
        </BonusRuleSection>

        <BonusRuleSection>
          <BonusRuleSectionTitle>Правила в группе</BonusRuleSectionTitle>
          <p className="mb-3 text-xs text-muted-foreground">
            Отметьте минимум 2 активных правила. В заказе агент сможет выбрать не больше указанного лимита.
          </p>
          {rulesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка правил…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {renderRuleList("Бонусы", bonusRules, "Нет активных бонусов.")}
              {renderRuleList("Скидки", discountRules, "Нет активных скидок.")}
            </div>
          )}
          {memberCount > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Выбрано: <span className="font-medium text-foreground">{memberCount}</span>
              {memberCount >= 2 ? (
                <>
                  {" "}
                  · агент выбирает до{" "}
                  <span className="font-medium text-foreground">{maxSelect}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </BonusRuleSection>

        <BonusRuleSection>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <BonusRuleSectionTitle>Привязка к заказу</BonusRuleSectionTitle>
              <p className="text-xs text-muted-foreground">
                Филиалы, агенты и направления — как у бонусов и скидок. Пусто = без ограничения.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => setScopeOpen(true)}
              disabled={!tenantSlug}
            >
              <UserRound className="size-3.5" />
              Настроить привязку
            </Button>
          </div>

          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-3 text-sm",
              hasScopeLimits ? "border-primary/25 bg-primary/5" : "border-border/70 bg-muted/20"
            )}
          >
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <span className={hasScopeLimits ? "font-medium text-foreground" : "text-muted-foreground"}>
              {scopeSummary}
            </span>
            {hasScopeLimits ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs text-muted-foreground"
                onClick={() => setScope(emptyScope())}
              >
                Сбросить
              </Button>
            ) : null}
          </div>

          {hasScopeLimits ? (
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {scope.scope_branch_codes.length > 0 ? (
                <li>
                  <span className="font-medium text-foreground">Филиалы:</span>{" "}
                  {scope.scope_branch_codes.join(", ")}
                </li>
              ) : null}
              {scope.scope_agent_user_ids.length > 0 ? (
                <li>
                  <span className="font-medium text-foreground">Агенты:</span>{" "}
                  {scope.scope_agent_user_ids.map((id) => `#${id}`).join(", ")}
                </li>
              ) : null}
              {scope.scope_trade_direction_ids.length > 0 ? (
                <li>
                  <span className="font-medium text-foreground">Направления:</span>{" "}
                  {scope.scope_trade_direction_ids.map((id) => `#${id}`).join(", ")}
                </li>
              ) : null}
            </ul>
          ) : null}
        </BonusRuleSection>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {savedOk && isEdit ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Сохранено. Возврат к списку…</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={saveMut.isPending}
            onClick={() => {
              setError(null);
              setSavedOk(false);
              saveMut.mutate();
            }}
          >
            {saveMut.isPending ? "Сохранение…" : isEdit ? "Сохранить изменения" : "Сохранить"}
          </Button>
          <Link href="/settings/bonus-strategies" className={cn(buttonVariants({ variant: "outline" }))}>
            Отмена
          </Link>
        </div>
      </div>

      {tenantSlug ? (
        <BonusStrategyScopeDialog
          open={scopeOpen}
          onOpenChange={setScopeOpen}
          tenantSlug={tenantSlug}
          title={name.trim() ? `Привязка: ${name.trim()}` : "Привязка стратегии"}
          value={scope}
          onApply={(next) => {
            setScope(next);
            setScopeOpen(false);
          }}
        />
      ) : null}
    </PageShell>
  );
}
