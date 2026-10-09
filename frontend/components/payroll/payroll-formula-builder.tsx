"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CheckCircle2, Search, XCircle } from "lucide-react";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, roleLabel, type Ym } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";
import { FORMULA_SCOPES, type FormulaDraft } from "@/components/payroll/payroll-formula-editor";
import { PayrollFormulaCalc, PayrollFormulaTokens } from "@/components/payroll/payroll-formula-calc";
import { PayrollFormulaToolbar } from "@/components/payroll/payroll-formula-toolbar";
import { PAYROLL_BTN, PAYROLL_CHECKBOX, PayrollModalField } from "@/components/payroll/kit/payroll-kit-modal";
import { PayrollPickMonth, PayrollPickSelect } from "@/components/payroll/kit/payroll-kit-picker";

type Vars = { groups: Array<{ group: string; items: string[] }>; functions: string[]; kpi_groups: Array<{ id: number; name: string }> };
type Validation = { ok: boolean; error?: string; unknown: string[] };
type Preview = { ok: boolean; value?: number; warnings?: string[]; variables?: Record<string, number>; validation?: Validation };

const FIELD =
  "h-[46px] w-full rounded-lg border border-[var(--pr-input)] bg-card pl-3 pt-[18px] text-[13px] font-medium text-foreground shadow-sm transition-colors placeholder:font-normal placeholder:text-muted-foreground/50 hover:border-[var(--pr-field-hover)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] disabled:cursor-not-allowed disabled:opacity-60";
const SMALL = "h-8 rounded-lg border border-[var(--pr-input)] bg-card px-2 text-[12.5px] shadow-sm focus:border-primary focus:outline-none";
const BASE_VAR = "Базовый оклад";
const LAST_TOKEN = /(\[[^\]]*\]?|>=|<=|<>|[^\s()+\-*/;<>=[\]]+|\S)$/;

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
  bodyHeight?: string;
};

/** Template «Установка формулу» layout: selects on top, values list, formula canvas with keypad. */
export function PayrollFormulaBuilder({
  draft: d,
  onChange,
  onSave,
  onClear,
  saving,
  canEdit,
  items,
  roles,
  employees,
  bodyHeight = "lg:h-[clamp(360px,calc(94vh-256px),600px)]"
}: Props) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const [search, setSearch] = useState("");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewUser, setPreviewUser] = useState("");
  const [previewYm, setPreviewYm] = useState<Ym>(currentYm());
  const [previewGroup, setPreviewGroup] = useState("");
  const [manual, setManual] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLElement>(null);

  const varsQ = useQuery({ queryKey: ["payroll-formula-vars", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Vars>("/formulas/variables") });

  useEffect(() => setPreview(null), [d.id, d.text]);
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
  const values = useMemo(() => {
    const s = search.trim().toLowerCase();
    const all = (varsQ.data?.groups ?? []).flatMap((g) => g.items);
    return [...new Set(all)].filter((x) => x !== BASE_VAR && (!s || x.toLowerCase().includes(s)));
  }, [varsQ.data, search]);

  const setText = (text: string, caret?: number) => {
    onChange({ ...d, text });
    if (caret == null) return;
    requestAnimationFrame(() => {
      textRef.current?.focus();
      textRef.current?.setSelectionRange(caret, caret);
    });
  };
  const insert = (snippet: string) => {
    if (!canEdit) return;
    const el = textRef.current;
    const start = el?.selectionStart ?? d.text.length;
    const end = el?.selectionEnd ?? d.text.length;
    setText(d.text.slice(0, start) + snippet + d.text.slice(end), start + snippet.length);
  };
  const backspace = () => {
    const el = textRef.current;
    if (!el) {
      const t = d.text.trimEnd();
      return setText(/\d$/.test(t) ? t.slice(0, -1) : t.replace(LAST_TOKEN, ""));
    }
    const start = el?.selectionStart ?? d.text.length;
    const end = el?.selectionEnd ?? d.text.length;
    if (start !== end) setText(d.text.slice(0, start) + d.text.slice(end), start);
    else if (start > 0) setText(d.text.slice(0, start - 1) + d.text.slice(start), start - 1);
  };
  const flash = (text: string) => {
    setHint(text);
    setTimeout(() => setHint(null), 2500);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.text);
      flash("Формула скопирована");
    } catch {
      flash("Не удалось скопировать");
    }
  };
  const paste = async () => {
    try {
      const raw = (await navigator.clipboard.readText()).trim();
      if (raw) insert(raw);
      else flash("Буфер обмена пуст");
    } catch {
      flash("Вставка недоступна в этом браузере");
    }
  };

  const runPreview = async () => {
    if (!d.text.trim()) return flash("Сначала составьте формулу");
    if (!previewUser) return flash("Выберите сотрудника для расчёта");
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
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PayrollPickSelect
          size="field"
          label="Роль"
          placeholder="Все роли"
          value={d.role ?? ""}
          disabled={!canEdit}
          options={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
          onChange={(v) => onChange({ ...d, role: v || null })}
        />
        <PayrollPickSelect
          size="field"
          label="Раздел"
          placeholder="Раздел"
          allowEmpty={false}
          value={d.scope}
          disabled={!canEdit}
          options={FORMULA_SCOPES.map((s) => ({ value: s.v, label: s.label, hint: s.hint }))}
          panelClassName="min-w-[340px]"
          onChange={(v) => onChange({ ...d, scope: v as FormulaDraft["scope"] })}
        />
        <PayrollPickSelect
          size="field"
          label={d.scope === "allowance" || d.scope === "bonus" ? "Надбавки" : "Надбавки / Удержания"}
          placeholder={needsTarget ? "— выберите статью —" : "Не требуется"}
          value={d.target_item_id != null ? String(d.target_item_id) : ""}
          disabled={!canEdit || !needsTarget}
          searchable={targetItems.length > 8}
          options={targetItems.map((i) => ({ value: String(i.id), label: i.name, hint: i.type === "allowance" ? "Надбавка (+)" : "Удержание (−)" }))}
          onChange={(v) => onChange({ ...d, target_item_id: v ? Number(v) : null })}
        />
        <PayrollModalField label="Название формулы">
          <input className={cn(FIELD, "pr-3")} value={d.name} disabled={!canEdit} placeholder="Например: Бонус за план" onChange={(e) => onChange({ ...d, name: e.target.value })} />
        </PayrollModalField>
      </div>
      <p className="mt-4 text-[13px] font-bold text-foreground">
        Выберите значения к формуле
        <span className="ml-2 text-[12px] font-normal text-muted-foreground">{FORMULA_SCOPES.find((s) => s.v === d.scope)?.hint}</span>
      </p>

      <div className={cn("mt-2 flex flex-col gap-3 lg:flex-row", bodyHeight)}>
        <aside className="flex min-h-0 w-full shrink-0 flex-col rounded-xl border border-[var(--pr-field)] bg-card p-3 lg:w-[300px]">
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск"
              aria-label="Поиск значений"
              className="h-9 w-full rounded-lg border border-[var(--pr-input)] bg-card pl-9 pr-3 text-[13px] shadow-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)]"
            />
          </div>
          <button
            type="button"
            onClick={() => insert(`[${BASE_VAR}]`)}
            title="Вставить базовый оклад сотрудника в формулу"
            className="mb-2.5 flex w-full items-center gap-2.5 rounded-lg border border-[var(--pr-brand-200)] bg-[var(--pr-brand-50)] px-3 py-2 text-left transition-colors hover:bg-[var(--pr-brand-100)]"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-card text-[var(--pr-brand-600)] shadow-sm">
              <Banknote className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-[var(--pr-brand-700)]">{BASE_VAR}</span>
              <span className="block text-[11.5px] text-[var(--pr-brand-600)] opacity-80">
                {d.role ? `берётся из «Базовые оклады» (${roleLabel(d.role)})` : "берётся из «Базовые оклады»"}
              </span>
            </span>
          </button>
          <p className="px-1 pb-2 text-[12px] font-bold text-foreground">Системные значения</p>
          <ul className="max-h-[360px] min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 lg:max-h-none">
            {varsQ.isLoading ? <li className="px-2 py-4 text-center text-[12px] text-muted-foreground">Загрузка…</li> : null}
            {!varsQ.isLoading && values.length === 0 ? <li className="px-2 py-4 text-center text-[12px] text-muted-foreground">По вашему запросу ничего не найдено</li> : null}
            {values.map((v) => (
              <li key={v}>
                <button
                  type="button"
                  onClick={() => insert(`[${v}]`)}
                  className="w-full rounded-lg border border-[var(--pr-field)] bg-card px-3 py-[7px] text-left text-[12.5px] text-foreground/70 shadow-sm transition-colors hover:border-[var(--pr-brand-200)] hover:bg-[var(--pr-brand-50)] hover:text-[var(--pr-brand-700)]"
                >
                  {v}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section ref={canvasRef} className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl lg:min-h-0 border border-[var(--pr-field)] bg-[#fcfdff] p-4 dark:bg-muted/20">
          <div className="flex flex-wrap items-center gap-1.5 lg:pr-[256px]">
            <PayrollFormulaToolbar
              canEdit={canEdit}
              manual={manual}
              functions={varsQ.data?.functions ?? []}
              onCopy={() => void copy()}
              onPaste={() => void paste()}
              onToggleManual={() => setManual((v) => !v)}
              onClear={() => setText("")}
              onInsert={insert}
            />
            {d.text.trim() ? <PayrollFormulaTokens text={d.text} /> : null}
            {hint ? <span className="ml-1 text-[12px] text-[var(--pr-brand-600)]">{hint}</span> : null}
          </div>

          <div className="mt-3 lg:pr-[256px]">
            {manual ? (
              <textarea
                ref={textRef}
                value={d.text}
                disabled={!canEdit}
                onChange={(e) => onChange({ ...d, text: e.target.value })}
                rows={3}
                spellCheck={false}
                autoFocus
                aria-label="Формула"
                placeholder="Например: [Базовый оклад] * 0,1"
                className="w-full resize-y rounded-lg border border-[var(--pr-input)] bg-card px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground/80 shadow-sm outline-none placeholder:font-sans placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-[var(--pr-brand-100)]"
              />
            ) : null}
            {validation ? (
              validation.ok ? (
                <p className="mt-3 flex items-center gap-1 text-[12.5px] text-emerald-700"><CheckCircle2 className="size-4" /> Формула корректна</p>
              ) : (
                <p className="mt-3 flex items-center gap-1 text-[12.5px] text-rose-700">
                  <XCircle className="size-4 shrink-0" /> {validation.error}
                  {validation.unknown.length ? ` — неизвестно: ${validation.unknown.join(", ")}` : ""}
                </p>
              )
            ) : null}
          </div>

          {preview ? (
            <div className="absolute bottom-4 left-4 right-4 lg:right-[272px]">
              <div className="max-h-[180px] overflow-auto rounded-lg border border-[var(--pr-border)] bg-card px-3 py-2 text-[12.5px] shadow-sm">
                {preview.ok ? (
                  <p className="text-[14px] font-bold">Результат: <span className="text-[var(--pr-brand-600)]">{money(preview.value ?? 0, 2)}</span></p>
                ) : (
                  <p className="text-rose-700">{preview.validation?.error ?? "Ошибка"}</p>
                )}
                {Object.entries(preview.variables ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-dashed border-[var(--pr-line)] py-0.5 text-[12px] text-muted-foreground">
                    <span>[{k}]</span><span className="tabular-nums text-foreground">{money(v, 2)}</span>
                  </div>
                ))}
                {(preview.warnings ?? []).map((w) => <p key={w} className="text-[12px] text-amber-700">{w}</p>)}
              </div>
            </div>
          ) : null}

          <PayrollFormulaCalc canvasRef={canvasRef} disabled={!canEdit} onInsert={insert} onBackspace={backspace} onClear={() => setText("")} onEquals={() => void runPreview()} />
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <label className="flex items-center gap-2" title="Выключенная формула сохраняется, но не участвует в расчёте зарплаты">
          <input type="checkbox" className={PAYROLL_CHECKBOX} checked={d.is_active} disabled={!canEdit} onChange={(e) => onChange({ ...d, is_active: e.target.checked })} />
          Активна
        </label>
        <label className="flex items-center gap-2 text-muted-foreground" title="Очерёдность расчёта: формула с меньшим числом считается раньше, её результат могут использовать следующие формулы">
          Порядок
          <input type="number" className={cn(SMALL, "w-[72px] text-foreground")} value={d.priority} disabled={!canEdit} onChange={(e) => onChange({ ...d, priority: Number(e.target.value) || 0 })} />
        </label>
        {canEdit ? (
          <button
            type="button"
            onClick={onClear}
            title={d.id ? "Выйти из редактирования без сохранения" : "Очистить все поля"}
            className="text-[12.5px] font-medium text-muted-foreground hover:text-rose-600"
          >
            {d.id ? "Отменить изменение" : "Очистить"}
          </button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2" title="Проверка формулы на данных сотрудника — затем нажмите «=» на калькуляторе">
          <PayrollPickSelect
            className="w-[190px]"
            panelClassName="w-[280px]"
            side="top"
            searchable
            placeholder="Проверка: сотрудник…"
            value={previewUser}
            options={employees.filter((x) => !d.role || x.role === d.role).map((x) => ({ value: String(x.user_id), label: x.fio, hint: roleLabel(x.role) }))}
            onChange={setPreviewUser}
          />
          <PayrollPickMonth className="w-[150px]" side="top" value={previewYm} onChange={setPreviewYm} />
          <PayrollPickSelect
            className="w-[150px]"
            panelClassName="right-0 w-[240px]"
            side="top"
            placeholder="Все KPI-группы"
            emptyText="KPI-группы не настроены"
            value={previewGroup}
            options={(varsQ.data?.kpi_groups ?? []).map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={setPreviewGroup}
          />
        </div>
        {canEdit ? (
          <button type="button" className={cn(PAYROLL_BTN.primary, "min-w-[96px] rounded-[10px] px-5")} disabled={!canSave} onClick={onSave}>
            {d.id ? "Сохранить изменения" : "Сохранить"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
