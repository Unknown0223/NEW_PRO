"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Lock, Plus } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { api as http } from "@/lib/api";
import { useTenant } from "@/lib/api-client";
import { usePermissions } from "@/lib/use-permissions";
import { currentYm, payrollApi, roleLabel, ymQuery } from "@/lib/payroll/payroll-api";
import { toBody, toDraft, newKey, ymText, type SchemeDraft, type SchemeMatch, type SchemeRow } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";
import { useNotice } from "@/components/payroll/payroll-ui";
import { PayrollPageTitle, PayrollSegmentedTabs } from "@/components/payroll/kit/payroll-kit-layout";
import { PayrollRelatedBar } from "@/components/payroll/kit/payroll-kit-related";
import { usePayrollConfirm } from "@/components/payroll/kit/payroll-kit-modal";
import { PAYROLL_CARD, PAYROLL_TABLE, PAYROLL_TD as TD, PAYROLL_TH as TH, PAYROLL_THEAD, PAYROLL_TR, PayrollEmptyRow } from "@/components/payroll/kit/payroll-kit-table";
import { SchemeOptionsCtx, type SchemeOptions } from "@/components/payroll/schemes/scheme-fields";
import { SchemeEditor } from "@/components/payroll/schemes/scheme-editor";
import { SchemePreviewPanel } from "@/components/payroll/schemes/scheme-preview";
import { SchemeOverridesPanel } from "@/components/payroll/schemes/scheme-overrides";

type Tab = "schemes" | "overrides" | "coverage";
type Item = SchemeOptions["items"][number];

function blankDraft(): SchemeDraft {
  const c = currentYm();
  return {
    name: "",
    roles: ["agent"],
    branches: [],
    trade_direction_ids: [],
    positions: [],
    valid_from: c.year * 100 + c.month,
    valid_to: null,
    is_active: true,
    note: null,
    rules: [{ key: newKey(), code: "base", name: "Оклад", kind: "base", item_id: null, params: { amount: 0, prorate: true, cases: [], when: [] } }]
  };
}

const bodyKey = (d: SchemeDraft | null) => (d ? JSON.stringify(toBody(d)) : "");

export function PayrollSchemesWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.hasAny("staff.zarplaty.update", "staff.zarplaty.create");
  const notice = useNotice();
  const { confirm, dialog } = usePayrollConfirm();
  const [tab, setTab] = useState<Tab>("schemes");
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<SchemeDraft | null>(null);
  const ym = currentYm();

  const on = Boolean(tenant);
  const listQ = useQuery({ queryKey: ["payroll-schemes", tenant], enabled: on, queryFn: () => api.get<SchemeRow[]>("/schemes") });
  const matchQ = useQuery({ queryKey: ["payroll-scheme-matches", tenant, ym.year, ym.month], enabled: on, queryFn: () => api.get<SchemeMatch[]>(`/schemes/matches?${ymQuery(ym)}`) });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: on, queryFn: () => api.get<Item[]>("/items") });
  const varsQ = useQuery({ queryKey: ["payroll-formula-vars", tenant], enabled: on, queryFn: () => api.get<{ kpi_groups: Array<{ id: number; name: string }> }>("/formulas/variables") });
  const tdQ = useQuery({
    queryKey: ["trade-directions", tenant, "payroll-schemes"],
    enabled: on,
    queryFn: async () => (await http.get<{ data: Array<{ id: number; name: string }> }>(`/api/${tenant}/trade-directions?is_active=true`)).data.data ?? []
  });

  const schemes = useMemo(() => listQ.data ?? [], [listQ.data]);
  const matches = useMemo(() => matchQ.data ?? [], [matchQ.data]);
  const current = typeof selected === "number" ? schemes.find((s) => s.id === selected) ?? null : null;

  useEffect(() => {
    if (selected == null && schemes.length) setSelected(schemes[0]!.id);
  }, [schemes, selected]);
  const currentRev = current ? `${current.id}:${current.updated_at}` : "";
  useEffect(() => {
    if (selected === "new") return;
    setDraft(current ? toDraft(current) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fon refetch tahrirni o'chirmasin
  }, [currentRev, selected]);

  const options: SchemeOptions = useMemo(() => {
    const branches = new Set<string>();
    const positions = new Set<string>();
    for (const m of matches) {
      if (m.branch) branches.add(m.branch);
      if (m.position) positions.add(m.position);
    }
    for (const s of schemes) {
      s.branches.forEach((b) => branches.add(b));
      s.positions.forEach((p) => positions.add(p));
    }
    return {
      branches: [...branches].sort(),
      positions: [...positions].sort(),
      tradeDirections: tdQ.data ?? [],
      items: itemsQ.data ?? [],
      groups: varsQ.data?.kpi_groups ?? []
    };
  }, [matches, schemes, tdQ.data, itemsQ.data, varsQ.data]);

  const coverage = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of matches) if (x.scheme_id) m.set(x.scheme_id, (m.get(x.scheme_id) ?? 0) + 1);
    return m;
  }, [matches]);
  const uncovered = matches.filter((m) => !m.scheme_id);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["payroll-schemes", tenant] });
    void qc.invalidateQueries({ queryKey: ["payroll-scheme-matches", tenant] });
  };
  const save = useMutation({
    mutationFn: (d: SchemeDraft) => api.send<{ id: number }>(d.id ? "PUT" : "POST", d.id ? `/schemes/${d.id}` : "/schemes", toBody(d)),
    onSuccess: (row) => {
      notice.ok("Схема сохранена. Зарплаты открытых месяцев пересчитаются автоматически.");
      setSelected(row.id);
      refresh();
    },
    onError: notice.fail
  });
  const version = useMutation({
    mutationFn: ({ id, from }: { id: number; from: number }) => api.send<{ id: number }>("POST", `/schemes/${id}/version`, { valid_from: from }),
    onSuccess: (row) => {
      notice.ok("Создана новая версия. Измените в ней правила и сохраните.");
      setSelected(row.id);
      refresh();
    },
    onError: notice.fail
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/schemes/${id}`),
    onSuccess: () => {
      notice.ok("Схема удалена");
      setSelected(null);
      refresh();
    },
    onError: notice.fail
  });

  const dirty = selected === "new" || bodyKey(draft) !== bodyKey(current ? toDraft(current) : null);
  const pick = async (id: number | "new") => {
    if (dirty && draft && !(await confirm({ title: "Несохранённые изменения", message: "Перейти без сохранения?", confirmLabel: "Перейти", destructive: false }))) return;
    setSelected(id);
    if (id === "new") setDraft(blankDraft());
  };

  return (
    <PageShell className="payroll-template">
      <PayrollRelatedBar current="schemes" />
      <PayrollPageTitle
        title="Схемы расчёта"
        description="Кому и как начисляется зарплата: оклад, надбавки, KPI-фонд со шкалой, ставки и условия. Вся настройка — в одном месте, с проверкой на реальном сотруднике."
      />
      <PayrollSegmentedTabs<Tab>
        tabs={[
          { id: "schemes", label: "Схемы", count: schemes.length },
          { id: "overrides", label: "Индивидуальные условия" },
          { id: "coverage", label: "Кто на какой схеме", count: uncovered.length || undefined, dot: uncovered.length ? "muted" : "success" }
        ]}
        value={tab}
        onChange={setTab}
      />
      {notice.element}
      {uncovered.length && schemes.length ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:border-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          Без схемы: {uncovered.length} сотр. — они считаются по старым настройкам («Базовые оклады» и «Формулы»).
        </div>
      ) : null}

      <SchemeOptionsCtx.Provider value={options}>
        {tab === "schemes" ? (
          <div className="grid items-start gap-3 lg:grid-cols-[230px_minmax(0,1fr)] 2xl:grid-cols-[230px_minmax(0,1fr)_360px]">
            <aside className={cn(PAYROLL_CARD, "grid gap-1 p-2")}>
              {canEdit ? (
                <button type="button" onClick={() => void pick("new")} className="flex items-center gap-1.5 rounded-md px-2 py-2 text-[12.5px] font-semibold text-[var(--pr-brand-700)] hover:bg-[var(--pr-brand-50)]">
                  <Plus className="size-4" /> Новая схема
                </button>
              ) : null}
              {selected === "new" ? <div className="rounded-md bg-[var(--pr-brand-50)] px-2 py-2 text-[12.5px] font-semibold">Новая схема…</div> : null}
              {!schemes.length && !listQ.isLoading ? <p className="px-2 py-3 text-[12px] text-muted-foreground">Схем пока нет. Создайте первую — например, «Агент (стандарт)».</p> : null}
              {schemes.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void pick(s.id)}
                  className={cn("grid gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-[var(--pr-row-hover)]", selected === s.id && "bg-[var(--pr-brand-50)]", !s.is_active && "opacity-60")}
                >
                  <span className="flex items-center gap-1 text-[12.5px] font-semibold">
                    {s.locked_by ? <Lock className="size-3 text-muted-foreground" /> : null}
                    <span className="truncate">{s.name}</span>
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">{s.roles.map(roleLabel).join(", ")}{s.branches.length ? ` · ${s.branches.join(", ")}` : ""}</span>
                  <span className="text-[11px] text-muted-foreground">
                    с {ymText(s.valid_from)}
                    {s.valid_to ? ` по ${ymText(s.valid_to)}` : ""} · сотр.: {coverage.get(s.id) ?? 0}
                  </span>
                </button>
              ))}
            </aside>
            <section className={cn(PAYROLL_CARD, "p-3")}>
              {draft ? (
                <SchemeEditor
                  draft={draft}
                  onChange={setDraft}
                  lockedBy={current?.locked_by ?? null}
                  canEdit={canEdit}
                  saving={save.isPending}
                  dirty={dirty}
                  onSave={() => save.mutate(draft)}
                  onDuplicate={() => {
                    setSelected("new");
                    setDraft({ ...draft, id: undefined, name: `${draft.name} (копия)`, rules: draft.rules.map((r) => ({ ...r, key: newKey() })) });
                  }}
                  onDelete={async () => {
                    if (current && (await confirm({ title: "Удалить схему", message: `Удалить «${current.name}»? Сотрудники перейдут на старые настройки или другую подходящую схему.`, confirmLabel: "Удалить", destructive: true })))
                      remove.mutate(current.id);
                  }}
                  onVersion={(from) => current && version.mutate({ id: current.id, from })}
                />
              ) : (
                <p className="py-10 text-center text-[13px] text-muted-foreground">Выберите схему слева или создайте новую.</p>
              )}
            </section>
            {draft ? (
              <aside className={cn(PAYROLL_CARD, "p-3 lg:col-span-2 2xl:sticky 2xl:top-3 2xl:col-span-1")}>
                <h3 className="mb-2 text-[13.5px] font-semibold">Проверка на сотруднике</h3>
                <SchemePreviewPanel draft={draft} matches={matches} />
              </aside>
            ) : null}
          </div>
        ) : null}

        {tab === "overrides" ? (
          <section className={cn(PAYROLL_CARD, "p-3")}>
            <SchemeOverridesPanel schemes={schemes} matches={matches} canEdit={canEdit} onOk={notice.ok} onFail={notice.fail} />
          </section>
        ) : null}

        {tab === "coverage" ? (
          <section className={cn(PAYROLL_CARD, "overflow-x-auto")}>
            <table className={PAYROLL_TABLE}>
              <thead className={PAYROLL_THEAD}>
                <tr>
                  <th className={TH}>Сотрудник</th>
                  <th className={TH}>Роль</th>
                  <th className={TH}>Филиал</th>
                  <th className={TH}>Должность</th>
                  <th className={TH}>Схема ({ymText(ym.year * 100 + ym.month)})</th>
                </tr>
              </thead>
              <tbody>
                {matchQ.isLoading || !matches.length ? <PayrollEmptyRow colSpan={5} loading={matchQ.isLoading} /> : null}
                {matches.map((m) => (
                  <tr key={m.user_id} className={PAYROLL_TR}>
                    <td className={cn(TD, "font-medium")}>{m.name}</td>
                    <td className={TD}>{roleLabel(m.role)}</td>
                    <td className={TD}>{m.branch ?? "—"}</td>
                    <td className={TD}>{m.position ?? "—"}</td>
                    <td className={TD}>
                      {m.scheme_id ? (
                        <button type="button" className="font-medium text-[var(--pr-brand-700)] hover:underline" onClick={() => { setTab("schemes"); void pick(m.scheme_id!); }}>
                          {m.scheme_name}
                        </button>
                      ) : (
                        <span className="text-amber-700">по старым настройкам</span>
                      )}
                      {m.scheme_errors.length ? <span className="block text-[11px] text-rose-600">{m.scheme_errors.join("; ")}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </SchemeOptionsCtx.Provider>
      {dialog}
    </PageShell>
  );
}
