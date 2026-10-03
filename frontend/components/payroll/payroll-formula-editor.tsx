"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, CheckCircle2, FunctionSquare, Play, Save, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, roleLabel, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { MonthField } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { PAYROLL_INPUT, PAYROLL_SECONDARY_BTN } from "@/components/payroll/kit/payroll-kit-table";

export type FormulaDraft = {
  id?: number;
  name: string;
  scope: "bonus" | "allowance" | "salary" | "common";
  text: string;
  role: string | null;
  target_item_id: number | null;
  priority: number;
  is_active: boolean;
};

type Vars = { groups: Array<{ group: string; items: string[] }>; functions: string[]; kpi_groups: Array<{ id: number; name: string }> };
type Validation = { ok: boolean; error?: string; pos?: number; variables: string[]; unknown: string[] };
type Preview = { ok: boolean; value?: number; warnings?: string[]; variables?: Record<string, number>; validation?: Validation };

export const FORMULA_SCOPES: Array<{ v: FormulaDraft["scope"]; label: string; hint: string }> = [
  { v: "bonus", label: "Бонус (KPI)", hint: "Назначается сотрудникам в «Настройках бонусов и зарплат»" },
  { v: "allowance", label: "Надбавка по роли", hint: "Автоматически для всех сотрудников роли" },
  { v: "salary", label: "Расчёт оклада", hint: "Заменяет стандартный расчёт оклада для роли" },
  { v: "common", label: "Общая", hint: "Можно назначать вручную" }
];

const OPERATORS = ["+", "-", "*", "/", "(", ")", ">", "<", ">=", "<=", "=", "<>", ";"];
const SECTION = "rounded-xl border border-[var(--pr-border)] bg-card shadow-[var(--pr-shadow)]";
const INPUT = cn(PAYROLL_INPUT, "px-3 disabled:opacity-60");
const SMALL_TITLE = "text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80";
const VAR_BTN =
  "flex w-full items-center gap-2 rounded-lg border border-[var(--pr-field)] bg-card px-2.5 py-1.5 text-left text-[12px] text-foreground/70 shadow-sm transition-colors hover:border-[var(--pr-brand-200)] hover:bg-[var(--pr-brand-50)] hover:text-[var(--pr-brand-700)]";
const FUNC_CHIP =
  "inline-flex items-center gap-1 rounded-lg border border-[var(--pr-field)] bg-[var(--pr-head)] px-2.5 py-1 text-[12px] font-semibold text-foreground/70 transition-colors hover:border-[var(--pr-brand-200)] hover:bg-[var(--pr-brand-50)] hover:text-[var(--pr-brand-700)] disabled:opacity-50";
const OP_CHIP =
  "min-w-8 rounded-lg border border-[var(--pr-field)] bg-card px-2.5 py-1 text-[12.5px] font-semibold text-foreground/70 transition-colors hover:bg-muted disabled:opacity-50";

function F({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type Props = {
  draft: FormulaDraft;
  onChange: (d: FormulaDraft) => void;
  onSave: () => void;
  onClear: () => void;
  saving: boolean;
  canEdit: boolean;
  items: PayrollItem[];
  roles: string[];
  employees: Array<{ user_id: number; fio: string; role: string }>;
};

export function PayrollFormulaEditor({ draft: d, onChange, onSave, onClear, saving, canEdit, items, roles, employees }: Props) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewUser, setPreviewUser] = useState("");
  const [previewYm, setPreviewYm] = useState<Ym>(currentYm());
  const [previewGroup, setPreviewGroup] = useState("");
  const [search, setSearch] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const varsQ = useQuery({ queryKey: ["payroll-formula-vars", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Vars>("/formulas/variables") });

  useEffect(() => setPreview(null), [d.id]);
  useEffect(() => {
    if (!d.text.trim()) {
      setValidation(null);
      return;
    }
    const t = setTimeout(() => {
      api.send<Validation>("POST", "/formulas/validate", { text: d.text }).then(setValidation).catch(() => setValidation(null));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.text, tenant]);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (varsQ.data?.groups ?? []).map((g) => ({ ...g, items: g.items.filter((x) => !s || x.toLowerCase().includes(s)) })).filter((g) => g.items.length);
  }, [varsQ.data, search]);

  const insert = (snippet: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? d.text.length;
    const end = el?.selectionEnd ?? d.text.length;
    onChange({ ...d, text: d.text.slice(0, start) + snippet + d.text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + snippet.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const runPreview = async () => {
    if (!previewUser) return;
    try {
      setPreview(
        await api.send<Preview>("POST", "/formulas/preview", {
          text: d.text,
          user_id: Number(previewUser),
          ...previewYm,
          kpi_group_id: previewGroup ? Number(previewGroup) : null,
          target_item_id: d.target_item_id
        })
      );
    } catch (e) {
      setPreview({ ok: false, warnings: [payrollErrorText(e)] });
    }
  };

  const targetItems = items.filter((i) => !i.system_key && i.is_active);
  const needsTarget = d.scope !== "salary";
  const canSave = canEdit && !saving && d.name.trim() && d.text.trim() && validation?.ok !== false && !(d.scope === "allowance" && !d.target_item_id);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className={cn(SECTION, "flex max-h-[78vh] flex-col p-3")}>
        <p className="px-1 pb-2 text-[12px] font-bold">Значения</p>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input placeholder="Поиск значения" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(PAYROLL_INPUT, "pl-9 pr-3")} />
        </div>
        <div className="flex-1 space-y-3 overflow-auto pr-1">
          {varsQ.isLoading ? <p className="text-[13px] text-muted-foreground">Загрузка…</p> : null}
          {groups.map((g) => (
            <div key={g.group}>
              <p className="mb-1 px-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/80">{g.group}</p>
              <div className="space-y-1">
                {g.items.map((v) => (
                  <button key={v} type="button" onClick={() => insert(`[${v}]`)} className={VAR_BTN}>
                    <Calculator className="h-3.5 w-3.5 shrink-0 text-[var(--pr-brand-600)] opacity-70" aria-hidden />
                    <span className="truncate">{v}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className={SECTION}>
        <div className="grid gap-3 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <F label="Название формулы">
              <input className={INPUT} value={d.name} disabled={!canEdit} placeholder="Например: Бонус за выполнение плана" onChange={(e) => onChange({ ...d, name: e.target.value })} />
            </F>
            <F label="Раздел">
              <select className={INPUT} value={d.scope} disabled={!canEdit} onChange={(e) => onChange({ ...d, scope: e.target.value as FormulaDraft["scope"] })}>
                {FORMULA_SCOPES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </F>
            <F label="Роль">
              <select className={INPUT} value={d.role ?? ""} disabled={!canEdit} onChange={(e) => onChange({ ...d, role: e.target.value || null })}>
                <option value="">— любая —</option>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </F>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              {needsTarget ? (
                <F label="Результат записать в статью">
                  <select
                    className={INPUT}
                    value={d.target_item_id ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => onChange({ ...d, target_item_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">— выберите —</option>
                    {targetItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type === "allowance" ? "+" : "−"})</option>)}
                  </select>
                </F>
              ) : (
                <div />
              )}
              <F label="Порядок">
                <input type="number" className={INPUT} value={d.priority} disabled={!canEdit} onChange={(e) => onChange({ ...d, priority: Number(e.target.value) || 0 })} />
              </F>
            </div>
          </div>
          <p className="-mt-1 text-[12px] text-muted-foreground">{FORMULA_SCOPES.find((s) => s.v === d.scope)?.hint}</p>

          <F label="Формула">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-2.5 text-[13px] font-bold text-primary">=</span>
              <textarea
                ref={textRef}
                value={d.text}
                disabled={!canEdit}
                onChange={(e) => onChange({ ...d, text: e.target.value })}
                rows={5}
                spellCheck={false}
                placeholder="ЕСЛИ([KPI - Выполнение (%)] >= 100; [KPI - Сумма (Факт)] * 0,02; 0)"
                className="w-full resize-y rounded-lg border border-[var(--pr-input)] bg-card py-2 pl-7 pr-3 font-mono text-[13px] leading-relaxed shadow-sm outline-none placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-[var(--pr-brand-100)]"
              />
            </div>
          </F>
          {validation ? (
            validation.ok ? (
              <p className="-mt-1 flex items-center gap-1 text-[12.5px] text-emerald-700"><CheckCircle2 className="size-4" /> Формула корректна</p>
            ) : (
              <p className="-mt-1 flex items-center gap-1 text-[12.5px] text-rose-700">
                <XCircle className="size-4" /> {validation.error}
                {validation.unknown.length ? ` — неизвестно: ${validation.unknown.join(", ")}` : ""}
              </p>
            )
          ) : null}

          <div>
            <p className={cn(SMALL_TITLE, "mb-1.5")}>Функции</p>
            <div className="flex flex-wrap gap-1.5">
              {(varsQ.data?.functions ?? []).map((f) => (
                <button key={f} type="button" disabled={!canEdit} onClick={() => insert(`${f}(`)} className={FUNC_CHIP}>
                  <FunctionSquare className="h-3 w-3" aria-hidden />
                  {f}
                </button>
              ))}
            </div>
            <p className={cn(SMALL_TITLE, "mb-1.5 mt-3")}>Операторы</p>
            <div className="flex flex-wrap gap-1.5">
              {OPERATORS.map((op) => (
                <button key={op} type="button" disabled={!canEdit} onClick={() => insert(op === "(" || op === ")" ? op : ` ${op} `)} className={OP_CHIP}>{op}</button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--pr-border)] bg-[var(--pr-head)] p-3">
            <p className={cn(SMALL_TITLE, "mb-2")}>Проверка на реальных данных</p>
            <div className="flex flex-wrap items-end gap-2">
              <select className={cn(INPUT, "w-64 bg-card")} value={previewUser} onChange={(e) => setPreviewUser(e.target.value)}>
                <option value="">Сотрудник…</option>
                {employees.filter((x) => !d.role || x.role === d.role).map((x) => <option key={x.user_id} value={x.user_id}>{x.fio}</option>)}
              </select>
              <MonthField value={previewYm} onChange={setPreviewYm} />
              <select className={cn(INPUT, "w-48 bg-card")} value={previewGroup} onChange={(e) => setPreviewGroup(e.target.value)}>
                <option value="">Все KPI-группы</option>
                {(varsQ.data?.kpi_groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button type="button" className={cn(PAYROLL_SECONDARY_BTN, "disabled:opacity-50")} disabled={!previewUser || !d.text.trim()} onClick={() => void runPreview()}>
                <Play className="size-4" /> Посчитать
              </button>
            </div>
            {preview ? (
              <div className="mt-3 text-sm">
                {preview.ok ? <p className="text-base font-semibold">Результат: {money(preview.value ?? 0, 2)}</p> : <p className="text-red-700">{preview.validation?.error ?? "Ошибка"}</p>}
                {Object.entries(preview.variables ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed py-0.5 text-xs"><span>[{k}]</span><span className="tabular-nums">{money(v, 2)}</span></div>
                ))}
                {(preview.warnings ?? []).map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pr-line)] py-4">
          <div className="flex items-center gap-4">
            {canEdit ? (
              <button type="button" onClick={onClear} className="text-[12.5px] font-medium text-muted-foreground hover:text-rose-600">
                {d.id ? "Отменить изменение" : "Очистить"}
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" className="accent-primary" checked={d.is_active} disabled={!canEdit} onChange={(e) => onChange({ ...d, is_active: e.target.checked })} />
              Активна
            </label>
          </div>
          {canEdit ? (
            <Button className="h-9 gap-1.5 rounded-lg px-4 text-[13.5px]" disabled={!canSave} onClick={onSave}>
              <Save className="size-4" />
              {d.id ? "Сохранить изменения" : "Сохранить формулу"}
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
