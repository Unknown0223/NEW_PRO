"use client";

import { useState } from "react";
import { Copy, GitBranch, Lock, Plus, Save, Trash2 } from "lucide-react";
import { roleLabel } from "@/lib/payroll/payroll-api";
import {
  KIND_META,
  SCHEME_ROLES,
  defaultParams,
  newKey,
  nextCode,
  ymFromInput,
  ymToInputStr,
  type RuleKind,
  type SchemeDraft,
  type SchemeRuleDraft
} from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { PAYROLL_BTN } from "@/components/payroll/kit/payroll-kit-modal";
import { ChipMulti, Labeled, MINI, useSchemeOptions } from "./scheme-fields";
import { SchemeRuleCard } from "./scheme-rule-card";

const ADD_ORDER: RuleKind[] = ["base", "fixed", "kpi", "rate", "formula", "manual"];

export function SchemeEditor({
  draft,
  onChange,
  lockedBy,
  canEdit,
  saving,
  dirty,
  onSave,
  onDelete,
  onDuplicate,
  onVersion
}: {
  draft: SchemeDraft;
  onChange: (d: SchemeDraft) => void;
  lockedBy: string | null;
  canEdit: boolean;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onVersion: (from: number) => void;
}) {
  const o = useSchemeOptions();
  const [adding, setAdding] = useState(false);
  const [versionFrom, setVersionFrom] = useState("");
  const rulesLocked = !canEdit || Boolean(lockedBy);
  const set = (patch: Partial<SchemeDraft>) => onChange({ ...draft, ...patch });
  const setRule = (i: number, r: SchemeRuleDraft) => set({ rules: draft.rules.map((x, j) => (j === i ? r : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.rules];
    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
    set({ rules: next });
  };
  const add = (kind: RuleKind) => {
    const code = nextCode(kind, draft.rules.map((r) => r.code));
    set({ rules: [...draft.rules, { key: newKey(), code, name: kind === "base" ? "Оклад" : "", kind, item_id: null, params: defaultParams(kind) }] });
    setAdding(false);
  };
  const roleOptions = [...new Set([...SCHEME_ROLES, ...draft.roles])].map((r) => ({ value: r, label: roleLabel(r) }));
  const hasBase = draft.rules.some((r) => r.kind === "base");
  const usedItemIds = draft.rules.map((r) => r.item_id).filter((x): x is number => x != null);

  return (
    <div className="grid gap-3">
      {lockedBy ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <Lock className="size-4" />
          <span className="flex-1">
            Схема охватывает закрытый месяц ({lockedBy}). Правила и условия менять нельзя — можно переименовать, задать месяц окончания или создать новую версию.
          </span>
          {canEdit ? (
            <span className="flex items-center gap-1.5">
              <input type="month" className={cn(MINI, "w-36")} value={versionFrom} onChange={(e) => setVersionFrom(e.target.value)} />
              <button type="button" className={PAYROLL_BTN.secondary} disabled={!ymFromInput(versionFrom)} onClick={() => onVersion(ymFromInput(versionFrom)!)}>
                <GitBranch /> Новая версия
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-lg border border-[var(--pr-border)] p-3">
        <div className="flex flex-wrap items-end gap-2">
          <Labeled label="Название схемы" className="min-w-56 flex-1">
            <input className={cn(MINI, "font-medium")} value={draft.name} maxLength={160} disabled={!canEdit} onChange={(e) => set({ name: e.target.value })} />
          </Labeled>
          <Labeled label="Действует с">
            <input type="month" className={cn(MINI, "w-36")} value={ymToInputStr(draft.valid_from)} disabled={rulesLocked} onChange={(e) => set({ valid_from: ymFromInput(e.target.value) ?? draft.valid_from })} />
          </Labeled>
          <Labeled label="по (необяз.)">
            <input type="month" className={cn(MINI, "w-36")} value={ymToInputStr(draft.valid_to)} disabled={!canEdit} onChange={(e) => set({ valid_to: ymFromInput(e.target.value) })} />
          </Labeled>
          <label className="flex items-center gap-1.5 pb-1.5 text-[12.5px]">
            <input type="checkbox" className="size-4 accent-primary" checked={draft.is_active} disabled={rulesLocked} onChange={(e) => set({ is_active: e.target.checked })} />
            активна
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Labeled label="Роли (обязательно)" group>
            <ChipMulti options={roleOptions} value={draft.roles} onChange={(roles) => set({ roles })} disabled={rulesLocked} empty="выберите роль" />
          </Labeled>
          <Labeled label="Филиалы" group>
            <ChipMulti options={o.branches.map((b) => ({ value: b, label: b }))} value={draft.branches} onChange={(branches) => set({ branches })} disabled={rulesLocked} />
          </Labeled>
          <Labeled label="Направления торговли" group>
            <ChipMulti
              options={o.tradeDirections.map((t) => ({ value: t.id, label: t.name }))}
              value={draft.trade_direction_ids}
              onChange={(trade_direction_ids) => set({ trade_direction_ids })}
              disabled={rulesLocked}
            />
          </Labeled>
          <Labeled label="Должности" group>
            <ChipMulti options={o.positions.map((p) => ({ value: p, label: p }))} value={draft.positions} onChange={(positions) => set({ positions })} disabled={rulesLocked} />
          </Labeled>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          Пустой фильтр — все. Если сотруднику подходят несколько схем, действует самая точная (больше заполненных фильтров).
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13.5px] font-semibold">Правила</h3>
          <span className="text-[12px] text-muted-foreground">считаются сверху вниз; формулы видят суммы правил выше</span>
        </div>
        {draft.rules.map((r, i) => (
          <SchemeRuleCard
            key={r.key}
            rule={r}
            disabled={rulesLocked}
            usedItemIds={usedItemIds}
            canUp={i > 0}
            canDown={i < draft.rules.length - 1}
            onMove={(dir) => move(i, dir)}
            onChange={(n) => setRule(i, n)}
            onRemove={() => set({ rules: draft.rules.filter((_, j) => j !== i) })}
          />
        ))}
        {!rulesLocked ? (
          adding ? (
            <div className="grid gap-1.5 rounded-lg border border-dashed border-[var(--pr-border)] p-2 sm:grid-cols-3">
              {ADD_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={k === "base" && hasBase}
                  onClick={() => add(k)}
                  className="rounded-md border border-[var(--pr-border)] px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-[var(--pr-brand-50)] disabled:opacity-40"
                >
                  <span className="block text-[12.5px] font-semibold">{KIND_META[k].label}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{KIND_META[k].hint}</span>
                </button>
              ))}
            </div>
          ) : (
            <button type="button" className={cn(PAYROLL_BTN.secondary, "justify-self-start")} onClick={() => setAdding(true)}>
              <Plus /> Добавить правило
            </button>
          )
        ) : null}
      </div>

      {canEdit ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-[var(--pr-line)] bg-card py-2">
          <button type="button" className={PAYROLL_BTN.primary} disabled={saving || !dirty || !draft.name.trim() || !draft.roles.length} onClick={onSave}>
            <Save /> {draft.id ? "Сохранить" : "Создать схему"}
          </button>
          {dirty ? <span className="text-[12px] text-amber-700">Есть несохранённые изменения</span> : null}
          <span className="flex-1" />
          {draft.id ? (
            <>
              <button type="button" className={PAYROLL_BTN.secondary} onClick={onDuplicate}>
                <Copy /> Копия
              </button>
              {!lockedBy ? (
                <button type="button" className={PAYROLL_BTN.dangerGhost} onClick={onDelete}>
                  <Trash2 /> Удалить
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
