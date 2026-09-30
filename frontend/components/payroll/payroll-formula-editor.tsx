"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Play, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, roleLabel, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { Field, MonthField, NATIVE_SELECT, selectCls } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

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
const CHIP = "rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary";
const SECTION = "rounded-lg border border-border bg-card shadow-sm";

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
      <aside className={cn(SECTION, "flex max-h-[78vh] flex-col")}>
        <div className="border-b border-border/80 px-4 py-3">
          <h2 className="text-sm font-bold">Значения</h2>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Поиск значения" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8" />
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-3">
          {varsQ.isLoading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
          {groups.map((g) => (
            <div key={g.group}>
              <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insert(`[${v}]`)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Calculator className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <span className="truncate">{v}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className={SECTION}>
        <div className="grid gap-4 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Название формулы">
              <Input value={d.name} disabled={!canEdit} placeholder="Например: Бонус за выполнение плана" onChange={(e) => onChange({ ...d, name: e.target.value })} />
            </Field>
            <Field label="Раздел">
              <select className={NATIVE_SELECT} value={d.scope} disabled={!canEdit} onChange={(e) => onChange({ ...d, scope: e.target.value as FormulaDraft["scope"] })}>
                {FORMULA_SCOPES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Роль">
              <select className={NATIVE_SELECT} value={d.role ?? ""} disabled={!canEdit} onChange={(e) => onChange({ ...d, role: e.target.value || null })}>
                <option value="">— любая —</option>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              {needsTarget ? (
                <Field label="Результат записать в статью">
                  <select
                    className={NATIVE_SELECT}
                    value={d.target_item_id ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => onChange({ ...d, target_item_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">— выберите —</option>
                    {targetItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type === "allowance" ? "+" : "−"})</option>)}
                  </select>
                </Field>
              ) : (
                <div />
              )}
              <Field label="Порядок">
                <Input type="number" value={d.priority} disabled={!canEdit} onChange={(e) => onChange({ ...d, priority: Number(e.target.value) || 0 })} />
              </Field>
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">{FORMULA_SCOPES.find((s) => s.v === d.scope)?.hint}</p>

          <Field label="Формула">
            <textarea
              ref={textRef}
              value={d.text}
              disabled={!canEdit}
              onChange={(e) => onChange({ ...d, text: e.target.value })}
              rows={6}
              spellCheck={false}
              placeholder="ЕСЛИ([KPI - Выполнение (%)] >= 100; [KPI - Сумма (Факт)] * 0,02; 0)"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </Field>
          {validation ? (
            validation.ok ? (
              <p className="-mt-2 flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Формула корректна</p>
            ) : (
              <p className="-mt-2 flex items-center gap-1 text-sm text-red-700">
                <XCircle className="size-4" /> {validation.error}
                {validation.unknown.length ? ` — неизвестно: ${validation.unknown.join(", ")}` : ""}
              </p>
            )
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Функции</p>
              <div className="flex flex-wrap gap-1.5">
                {(varsQ.data?.functions ?? []).map((f) => (
                  <button key={f} type="button" disabled={!canEdit} onClick={() => insert(`${f}(`)} className={CHIP}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Операторы</p>
              <div className="flex flex-wrap gap-1.5">
                {OPERATORS.map((op) => (
                  <button key={op} type="button" disabled={!canEdit} onClick={() => insert(op === "(" || op === ")" ? op : ` ${op} `)} className={cn(CHIP, "min-w-8")}>{op}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Проверка на реальных данных</p>
            <div className="flex flex-wrap items-end gap-2">
              <select className={selectCls("w-64")} value={previewUser} onChange={(e) => setPreviewUser(e.target.value)}>
                <option value="">Сотрудник…</option>
                {employees.filter((x) => !d.role || x.role === d.role).map((x) => <option key={x.user_id} value={x.user_id}>{x.fio}</option>)}
              </select>
              <MonthField value={previewYm} onChange={setPreviewYm} />
              <select className={selectCls("w-48")} value={previewGroup} onChange={(e) => setPreviewGroup(e.target.value)}>
                <option value="">Все KPI-группы</option>
                {(varsQ.data?.kpi_groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-9" disabled={!previewUser || !d.text.trim()} onClick={() => void runPreview()}>
                <Play className="mr-1 size-4" /> Посчитать
              </Button>
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
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/25 px-4 py-3 sm:px-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary" checked={d.is_active} disabled={!canEdit} onChange={(e) => onChange({ ...d, is_active: e.target.checked })} />
            Активна
          </label>
          {canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClear}>{d.id ? "Отменить изменение" : "Очистить"}</Button>
              <Button disabled={!canSave} onClick={onSave}>{d.id ? "Сохранить изменения" : "Сохранить формулу"}</Button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
