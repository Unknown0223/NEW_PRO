"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, money, payrollApi, payrollErrorText, RECORD_STATUS, roleLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { EmptyRow, Field, MonthField, NATIVE_SELECT, selectCls, StatusBadge, Toolbar, useNotice, useSelection } from "@/components/payroll/payroll-ui";
import type { PayrollItem } from "@/components/payroll/payroll-items-workspace";

type Metrics = { cost: number; count: number; volume: number; acb: number; order_count: number };
type Assign = { id: number; kpi_group_id: number; formula_id: number; formula_name: string | null; formula_text: string; target_item_name: string | null; value: number | null };
type GroupCell = { kpi_group_id: number; name: string; fact: Metrics; plan: Metrics; assignments: Assign[] };
type BonusRow = { user_id: number; fio: string; code: string | null; role: string; is_active: boolean; record_status: string | null; fact: Metrics; plan: Metrics; assignments_all: Assign[]; groups: GroupCell[] };
type BonusData = { closed: boolean; groups: Array<{ id: number; name: string }>; rows: BonusRow[] };
type Formula = { id: number; name: string; scope: string; is_active: boolean; target_item_id: number | null; text: string };
type Target = { userIds: number[]; groupId: number };

const pct = (f: number, p: number) => (p > 0 ? `${Math.round((f / p) * 100)}%` : "—");

function PlanFact({ fact, plan }: { fact: Metrics; plan: Metrics }) {
  return (
    <div className="text-[11px] leading-tight tabular-nums">
      <div>Ф {money(fact.cost)}</div>
      <div className="text-muted-foreground">П {money(plan.cost)} · {pct(fact.cost, plan.cost)}</div>
    </div>
  );
}

export function PayrollBonusWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canAssign = perms.isAdmin || perms.has("staff.zarplaty.assign");
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const sel = useSelection<number>();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Target | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams(ymQuery(ym));
    if (role) p.set("role", role);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [ym, role, q]);

  const dataQ = useQuery({ queryKey: ["payroll-bonus-kpi", tenant, params], enabled: Boolean(tenant), queryFn: () => api.get<BonusData>(`/bonus-kpi?${params}`) });
  const formulasQ = useQuery({ queryKey: ["payroll-formulas", tenant], enabled: Boolean(tenant), queryFn: () => api.get<Formula[]>("/formulas") });
  const itemsQ = useQuery({ queryKey: ["payroll-items", tenant], enabled: Boolean(tenant), queryFn: () => api.get<PayrollItem[]>("/items") });
  const data = dataQ.data;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const groups = data?.groups ?? [];
  const roles = useMemo(() => [...new Set(rows.map((r) => r.role))].sort(), [rows]);
  const editable = canAssign && !data?.closed;

  const refresh = () => void qc.invalidateQueries({ queryKey: ["payroll-bonus-kpi", tenant] });
  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/bonus-assignments/${id}`),
    onSuccess: () => { notice.ok("Назначение удалено"); refresh(); },
    onError: notice.fail
  });

  const chips = (list: Assign[]) =>
    list.map((a) => (
      <span key={a.id} className="mt-1 inline-flex max-w-full items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-800" title={`${a.formula_text}\n→ ${a.target_item_name ?? ""}`}>
        <span className="truncate">{a.formula_name ?? `#${a.formula_id}`}</span>
        <b className="tabular-nums">{a.value == null ? "…" : money(a.value)}</b>
        {editable ? (
          <button
            type="button"
            className="opacity-60 hover:opacity-100"
            aria-label="Удалить"
            onClick={async () => {
              if (await confirm({ title: "Удалить назначение", message: `${a.formula_name ?? "Формула"} будет снята, зарплата пересчитается.`, confirmLabel: "Удалить", cancelLabel: "Отмена" })) remove.mutate(a.id);
            }}
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>
    ));

  const addBtn = (userIds: number[], groupId: number) =>
    editable ? (
      <button type="button" className="ml-1 inline-flex rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => setTarget({ userIds, groupId })} aria-label="Назначить">
        <Plus className="size-3" />
      </button>
    ) : null;

  return (
    <PageShell>
      <PageHeader
        title="Настройки бонусов и зарплат"
        description="План и факт KPI (доставлено − возвраты) по группам товаров; назначенные бонусные формулы и их результат за месяц."
        actions={<Link href="/users/salary/formulas" className={buttonVariants({ variant: "outline", size: "sm" })}>Конструктор формул</Link>}
      />
      {notice.element}
      <Toolbar>
        <MonthField value={ym} onChange={(v) => { setYm(v); sel.clear(); }} />
        <select className={selectCls("w-40")} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Все роли</option>
          {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
        <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-52" />
        <div className="flex-1" />
        {data?.closed ? <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-white">Месяц закрыт</span> : null}
        {editable ? (
          <Button size="sm" disabled={!sel.list.length} onClick={() => setTarget({ userIds: sel.list, groupId: 0 })}>
            Назначить формулу{sel.list.length ? ` (${sel.list.length})` : ""}
          </Button>
        ) : null}
      </Toolbar>

      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 text-left text-xs backdrop-blur">
            <tr>
              <th className="w-8 px-2 py-2">
                <input type="checkbox" checked={rows.length > 0 && sel.list.length === rows.length} onChange={(e) => sel.setAll(rows.map((r) => r.user_id), e.target.checked)} />
              </th>
              <th className="min-w-52 px-2">Сотрудник</th>
              <th className="min-w-40 px-2">Весь объём</th>
              {groups.map((g) => <th key={g.id} className="min-w-40 px-2">{g.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {dataQ.isLoading ? <EmptyRow colSpan={3 + groups.length} text="Загрузка…" /> : null}
            {!dataQ.isLoading && rows.length === 0 ? <EmptyRow colSpan={3 + groups.length} /> : null}
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t align-top">
                <td className="px-2 py-2"><input type="checkbox" checked={sel.ids.has(r.user_id)} onChange={() => sel.toggle(r.user_id)} /></td>
                <td className="px-2 py-2">
                  <div className={r.is_active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{r.fio}</div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {roleLabel(r.role)}{r.code ? ` · ${r.code}` : ""}
                    {r.record_status ? <StatusBadge map={RECORD_STATUS} status={r.record_status} /> : null}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex items-start"><PlanFact fact={r.fact} plan={r.plan} />{addBtn([r.user_id], 0)}</div>
                  <div className="flex flex-wrap gap-1">{chips(r.assignments_all)}</div>
                </td>
                {r.groups.map((g) => (
                  <td key={g.kpi_group_id} className="px-2 py-2">
                    <div className="flex items-start"><PlanFact fact={g.fact} plan={g.plan} />{addBtn([r.user_id], g.kpi_group_id)}</div>
                    <div className="flex flex-wrap gap-1">{chips(g.assignments)}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssignDialog
        target={target}
        ym={ym}
        groups={groups}
        formulas={(formulasQ.data ?? []).filter((f) => f.is_active && (f.scope === "bonus" || f.scope === "common"))}
        items={(itemsQ.data ?? []).filter((i) => !i.system_key && i.is_active && i.type === "allowance")}
        onClose={() => setTarget(null)}
        onDone={(t) => { notice.ok(t); sel.clear(); refresh(); }}
      />
      {dialog}
    </PageShell>
  );
}

function AssignDialog(props: {
  target: Target | null;
  ym: Ym;
  groups: Array<{ id: number; name: string }>;
  formulas: Formula[];
  items: PayrollItem[];
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const tenant = useTenant();
  const [groupId, setGroupId] = useState<number | null>(null);
  const [formulaId, setFormulaId] = useState("");
  const [itemId, setItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = props.target;
  const gid = groupId ?? t?.groupId ?? 0;
  const formula = props.formulas.find((f) => String(f.id) === formulaId);

  const save = useMutation({
    mutationFn: () =>
      payrollApi(tenant).send<{ saved: number; skipped_confirmed: number[] }>("POST", "/bonus-assignments", {
        ...props.ym,
        user_ids: t?.userIds ?? [],
        kpi_group_id: gid,
        formula_id: Number(formulaId),
        target_item_id: itemId ? Number(itemId) : null
      }),
    onSuccess: (r) => {
      props.onDone(`Назначено: ${r.saved}${r.skipped_confirmed.length ? `, пропущено подтверждённых ${r.skipped_confirmed.length}` : ""}`);
      close();
    },
    onError: (e) => setError(payrollErrorText(e))
  });

  function close() {
    setGroupId(null);
    setFormulaId("");
    setItemId("");
    setError(null);
    props.onClose();
  }

  return (
    <Dialog open={t != null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Назначить бонусную формулу</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">Сотрудников: {t?.userIds.length ?? 0}</p>
          <Field label="Группа KPI">
            <select className={NATIVE_SELECT} value={gid} onChange={(e) => setGroupId(Number(e.target.value))}>
              <option value={0}>Весь объём</option>
              {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Формула">
            <select className={NATIVE_SELECT} value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
              <option value="">— выберите —</option>
              {props.formulas.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          {formula ? <code className="block rounded bg-muted px-2 py-1 text-xs">{formula.text}</code> : null}
          <Field label="Статья начисления">
            <select className={NATIVE_SELECT} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Из формулы</option>
              {props.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </Field>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={close}>Отмена</Button>
            <Button size="sm" disabled={!formulaId || save.isPending || (!itemId && !formula?.target_item_id)} onClick={() => save.mutate()}>Назначить</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
