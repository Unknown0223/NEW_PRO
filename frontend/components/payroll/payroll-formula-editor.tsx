"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, roleLabel, type Ym } from "@/lib/payroll/payroll-api";
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

const SCOPES: Array<{ v: FormulaDraft["scope"]; label: string; hint: string }> = [
  { v: "bonus", label: "Бонус (KPI)", hint: "Назначается сотрудникам в «Настройках бонусов»" },
  { v: "allowance", label: "Надбавка по роли", hint: "Автоматически для всех сотрудников роли" },
  { v: "salary", label: "Расчёт оклада", hint: "Заменяет стандартный расчёт оклада для роли" },
  { v: "common", label: "Общая", hint: "Можно назначать вручную" }
];

type Props = {
  draft: FormulaDraft | null;
  onClose: () => void;
  onSave: (d: FormulaDraft) => void;
  saving: boolean;
  items: PayrollItem[];
  roles: string[];
  employees: Array<{ user_id: number; fio: string; role: string }>;
};

export function PayrollFormulaEditor({ draft: initial, onClose, onSave, saving, items, roles, employees }: Props) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const [d, setD] = useState<FormulaDraft | null>(initial);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewUser, setPreviewUser] = useState("");
  const [previewYm, setPreviewYm] = useState<Ym>(currentYm());
  const [previewGroup, setPreviewGroup] = useState("");
  const [search, setSearch] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setD(initial);
    setPreview(null);
    setValidation(null);
  }, [initial]);

  const varsQ = useQuery({ queryKey: ["payroll-formula-vars", tenant], enabled: Boolean(tenant && initial), queryFn: () => api.get<Vars>("/formulas/variables") });

  useEffect(() => {
    if (!d?.text.trim()) {
      setValidation(null);
      return;
    }
    const t = setTimeout(() => {
      api.send<Validation>("POST", "/formulas/validate", { text: d.text }).then(setValidation).catch(() => setValidation(null));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.text, tenant]);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (varsQ.data?.groups ?? []).map((g) => ({ ...g, items: g.items.filter((x) => !s || x.toLowerCase().includes(s)) })).filter((g) => g.items.length);
  }, [varsQ.data, search]);

  if (!d) return null;

  const insert = (snippet: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? d.text.length;
    const end = el?.selectionEnd ?? d.text.length;
    const text = d.text.slice(0, start) + snippet + d.text.slice(end);
    setD({ ...d, text });
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
          kpi_group_id: previewGroup ? Number(previewGroup) : null
        })
      );
    } catch (e) {
      setPreview({ ok: false, warnings: [payrollErrorText(e)] });
    }
  };

  const targetItems = items.filter((i) => !i.system_key && i.is_active);
  const needsTarget = d.scope !== "salary";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{d.id ? "Изменить формулу" : "Новая формула"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid content-start gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Название" className="col-span-2">
                <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
              </Field>
              <Field label="Тип">
                <select className={NATIVE_SELECT} value={d.scope} onChange={(e) => setD({ ...d, scope: e.target.value as FormulaDraft["scope"] })}>
                  {SCOPES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Роль">
                <select className={NATIVE_SELECT} value={d.role ?? ""} onChange={(e) => setD({ ...d, role: e.target.value || null })}>
                  <option value="">— любая —</option>
                  {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </Field>
              {needsTarget ? (
                <Field label="Результат записать в статью">
                  <select className={NATIVE_SELECT} value={d.target_item_id ?? ""} onChange={(e) => setD({ ...d, target_item_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— выберите —</option>
                    {targetItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.type === "allowance" ? "+" : "−"})</option>)}
                  </select>
                </Field>
              ) : null}
              <Field label="Порядок расчёта">
                <Input type="number" value={d.priority} onChange={(e) => setD({ ...d, priority: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">{SCOPES.find((s) => s.v === d.scope)?.hint}</p>
            <Field label="Формула">
              <textarea
                ref={textRef}
                value={d.text}
                onChange={(e) => setD({ ...d, text: e.target.value })}
                rows={5}
                spellCheck={false}
                placeholder="ЕСЛИ([KPI - Выполнение (%)] >= 100; [KPI - Сумма (Факт)] * 0,02; 0)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {(varsQ.data?.functions ?? []).map((f) => (
                <button key={f} type="button" onClick={() => insert(`${f}(`)} className="rounded border px-2 py-0.5 font-mono text-xs hover:bg-muted">{f}</button>
              ))}
              {["+", "-", "*", "/", ">=", "<=", "=", ";"].map((op) => (
                <button key={op} type="button" onClick={() => insert(` ${op} `)} className="rounded border px-2 py-0.5 font-mono text-xs hover:bg-muted">{op}</button>
              ))}
            </div>
            {validation ? (
              validation.ok ? (
                <p className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Формула корректна</p>
              ) : (
                <p className="flex items-center gap-1 text-sm text-red-700">
                  <XCircle className="size-4" /> {validation.error}
                  {validation.unknown.length ? ` — неизвестно: ${validation.unknown.join(", ")}` : ""}
                </p>
              )
            ) : null}
            <div className="rounded-lg border bg-muted/30 p-3">
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
                <Button size="sm" variant="outline" disabled={!previewUser || !d.text.trim()} onClick={() => void runPreview()}>
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
          <div className="grid max-h-[70vh] content-start gap-2 overflow-auto rounded-lg border p-2">
            <Input placeholder="Поиск переменной" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
            {groups.map((g) => (
              <div key={g.group}>
                <p className="px-1 pt-1 text-[11px] font-semibold uppercase text-muted-foreground">{g.group}</p>
                {g.items.map((v) => (
                  <button key={v} type="button" onClick={() => insert(`[${v}]`)} className="block w-full rounded px-1.5 py-1 text-left text-xs hover:bg-muted">{v}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} /> Активна
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Отмена</Button>
            <Button size="sm" disabled={saving || !d.name.trim() || !d.text.trim() || validation?.ok === false || (d.scope === "allowance" && !d.target_item_id)} onClick={() => onSave(d)}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
