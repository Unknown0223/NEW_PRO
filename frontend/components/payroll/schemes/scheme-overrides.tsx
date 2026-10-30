"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { ymFromInput, ymText, ymToInputStr, type SchemeMatch, type SchemeOverride, type SchemeRow } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { PayrollModal, PayrollModalActions, PayrollModalNote, usePayrollConfirm } from "@/components/payroll/kit/payroll-kit-modal";
import { PAYROLL_TABLE, PAYROLL_TD as TD, PAYROLL_TH as TH, PAYROLL_THEAD, PAYROLL_TR, PayrollEmptyRow, PayrollIconAction } from "@/components/payroll/kit/payroll-kit-table";
import { LINK_BTN, Labeled, MINI, NumField } from "./scheme-fields";

type Draft = { id?: number; user_id: number | null; rule_code: string; amount: number; valid_from: number; valid_to: number | null; note: string | null };

export function SchemeOverridesPanel({
  schemes,
  matches,
  canEdit,
  onOk,
  onFail
}: {
  schemes: SchemeRow[];
  matches: SchemeMatch[];
  canEdit: boolean;
  onOk: (t: string) => void;
  onFail: (e: unknown) => void;
}) {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const { confirm, dialog } = usePayrollConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const listQ = useQuery({ queryKey: ["payroll-scheme-overrides", tenant], enabled: Boolean(tenant), queryFn: () => api.get<SchemeOverride[]>("/scheme-overrides") });

  const byUser = useMemo(() => new Map(matches.map((m) => [m.user_id, m])), [matches]);
  const schemeById = useMemo(() => new Map(schemes.map((s) => [s.id, s])), [schemes]);
  const rulesFor = (userId: number | null) => {
    const sid = userId != null ? byUser.get(userId)?.scheme_id : null;
    const s = sid != null ? schemeById.get(sid) : null;
    const src = s ? [s] : schemes;
    const seen = new Map<string, string>();
    for (const sc of src) for (const r of sc.rules) if (r.kind !== "manual" && !seen.has(r.code)) seen.set(r.code, r.name);
    return [...seen].map(([code, name]) => ({ code, name }));
  };
  const ruleName = (userId: number, code: string) => rulesFor(userId).find((r) => r.code === code)?.name ?? code;

  const rows = (listQ.data ?? []).filter((r) => !q.trim() || `${r.user_name ?? ""} ${r.rule_code}`.toLowerCase().includes(q.trim().toLowerCase()));
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["payroll-scheme-overrides", tenant] });

  const save = useMutation({
    mutationFn: (d: Draft) => api.send(d.id ? "PUT" : "POST", d.id ? `/scheme-overrides/${d.id}` : "/scheme-overrides", { ...d, id: undefined }),
    onSuccess: () => {
      setDraft(null);
      invalidate();
      onOk("Индивидуальное условие сохранено. Зарплата сотрудника пересчитается.");
    },
    onError: onFail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/scheme-overrides/${id}`),
    onSuccess: () => {
      invalidate();
      onOk("Условие удалено");
    },
    onError: onFail
  });

  const cur = currentYm();
  const rules = draft ? rulesFor(draft.user_id) : [];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(MINI, "w-64")} placeholder="Поиск сотрудника" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="text-[12px] text-muted-foreground">Своя сумма оклада, надбавки или фонда KPI для сотрудника. Правила схемы при этом не меняются.</p>
        {canEdit ? (
          <button
            type="button"
            className={cn(LINK_BTN, "ml-auto")}
            onClick={() => setDraft({ user_id: null, rule_code: "", amount: 0, valid_from: cur.year * 100 + cur.month, valid_to: null, note: null })}
          >
            <Plus className="size-3.5" /> Добавить условие
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--pr-border)]">
        <table className={PAYROLL_TABLE}>
          <thead className={PAYROLL_THEAD}>
            <tr>
              <th className={TH}>Сотрудник</th>
              <th className={TH}>Правило</th>
              <th className={cn(TH, "text-right")}>Сумма</th>
              <th className={TH}>Период</th>
              <th className={TH}>Комментарий</th>
              <th className={cn(TH, "w-20")} />
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading || !rows.length ? <PayrollEmptyRow colSpan={6} loading={listQ.isLoading} text="Индивидуальных условий нет" /> : null}
            {rows.map((r) => (
              <tr key={r.id} className={PAYROLL_TR}>
                <td className={cn(TD, "font-medium")}>
                  {r.user_name ?? `#${r.user_id}`}
                  <span className="block text-[11px] font-normal text-muted-foreground">{roleLabel(byUser.get(r.user_id)?.role)}</span>
                </td>
                <td className={TD}>
                  {ruleName(r.user_id, r.rule_code)} <span className="font-mono text-[11px] text-muted-foreground">{r.rule_code}</span>
                </td>
                <td className={cn(TD, "text-right tabular-nums")}>{money(r.amount)}</td>
                <td className={TD}>
                  с {ymText(r.valid_from)}
                  {r.valid_to ? ` по ${ymText(r.valid_to)}` : ""}
                  {r.locked_by ? <Lock className="ml-1 inline size-3 text-muted-foreground" aria-label="Закрытый месяц" /> : null}
                </td>
                <td className={cn(TD, "text-muted-foreground")}>{r.note ?? ""}</td>
                <td className={TD}>
                  {canEdit ? (
                    <div className="inline-flex gap-1">
                      <PayrollIconAction label="Изменить" tone="edit" onClick={() => setDraft({ ...r })}>
                        <Pencil className="size-3.5" />
                      </PayrollIconAction>
                      {!r.locked_by ? (
                        <PayrollIconAction
                          label="Удалить"
                          tone="danger"
                          onClick={async () => {
                            if (await confirm({ title: "Удалить условие", message: `Удалить условие для «${r.user_name ?? r.user_id}»?`, confirmLabel: "Удалить", destructive: true }))
                              remove.mutate(r.id);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </PayrollIconAction>
                      ) : null}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PayrollModal open={draft != null} onClose={() => setDraft(null)} title={draft?.id ? "Изменить условие" : "Индивидуальное условие"} width="sm:max-w-[520px]">
        {draft ? (
          <div className="grid gap-3">
            <Labeled label="Сотрудник">
              <select className={MINI} value={draft.user_id ?? ""} disabled={Boolean(draft.id)} onChange={(e) => setDraft({ ...draft, user_id: Number(e.target.value) || null, rule_code: "" })}>
                <option value="">— выберите —</option>
                {matches.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name} · {roleLabel(m.role)}
                    {m.scheme_name ? ` · ${m.scheme_name}` : " · без схемы"}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Правило схемы">
              <select className={MINI} value={draft.rule_code} disabled={Boolean(draft.id)} onChange={(e) => setDraft({ ...draft, rule_code: e.target.value })}>
                <option value="">— выберите —</option>
                {rules.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </Labeled>
            <div className="grid grid-cols-3 gap-2">
              <Labeled label="Сумма, сум">
                <NumField className="w-full min-w-0" value={draft.amount} onChange={(v) => setDraft({ ...draft, amount: v ?? 0 })} />
              </Labeled>
              <Labeled label="С месяца">
                <input type="month" className={MINI} value={ymToInputStr(draft.valid_from)} onChange={(e) => setDraft({ ...draft, valid_from: ymFromInput(e.target.value) ?? draft.valid_from })} />
              </Labeled>
              <Labeled label="По месяц (необяз.)">
                <input type="month" className={MINI} value={ymToInputStr(draft.valid_to)} onChange={(e) => setDraft({ ...draft, valid_to: ymFromInput(e.target.value) })} />
              </Labeled>
            </div>
            <Labeled label="Комментарий">
              <input className={MINI} maxLength={500} value={draft.note ?? ""} onChange={(e) => setDraft({ ...draft, note: e.target.value || null })} />
            </Labeled>
            <PayrollModalNote>Для оклада и надбавок — это сумма вместо суммы схемы, для KPI — свой фонд. Действует с выбранного месяца.</PayrollModalNote>
            <PayrollModalActions
              onCancel={() => setDraft(null)}
              onSubmit={() => save.mutate(draft)}
              busy={save.isPending}
              disabled={!draft.user_id || !draft.rule_code}
            />
          </div>
        ) : null}
      </PayrollModal>
      {dialog}
    </div>
  );
}
