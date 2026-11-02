"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Lock, LockOpen, Plus, Save, Target, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import {
  fmtNormSum,
  parseNormSum,
  useAgentNormSettings,
  useSaveAgentNormSettings,
  type AgentNormOverride,
  type LeaderMinusMode,
  type LeaderMinusRule
} from "@/lib/timesheet/timesheet-norm-api";
import { TIMESHEET_ROLE_LABELS } from "@/components/timesheet/timesheet-shared";
import { branchVisibleName, isOpaqueBranchToken } from "@/lib/branch-options";

type Emp = { id: number; fio: string; role: string; login: string; code: string | null; branch: string | null };

function isAgent(role: string) {
  return role.trim().toLowerCase() === "agent";
}

function agentBranchLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || isOpaqueBranchToken(t)) return "—";
  return branchVisibleName(t, new Map()) ?? "—";
}

type Draft = {
  enabled: boolean;
  start_date: string;
  open: string;
  closed: string;
  min_orders: string;
  half_pct: string;
  overrides: AgentNormOverride[];
  leader_rules: LeaderMinusRule[];
};

function toDraft(s: {
  enabled: boolean;
  start_date: string;
  open_amount: number;
  closed_amount: number;
  min_orders?: number;
  half_day_ratio?: number;
  overrides?: AgentNormOverride[];
  leader_rules?: LeaderMinusRule[];
}): Draft {
  return {
    enabled: s.enabled,
    start_date: s.start_date,
    open: fmtNormSum(s.open_amount),
    closed: fmtNormSum(s.closed_amount),
    min_orders: String(s.min_orders ?? 0),
    half_pct: s.half_day_ratio ? String(Math.round(s.half_day_ratio * 100)) : "0",
    overrides: s.overrides ?? [],
    leader_rules: s.leader_rules ?? []
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export function TabelAgentNormWorkspace() {
  const { tenantSlug } = useAuthStore();
  const canEdit = usePermissions().hasAny("staff.tabel_normativ.update");
  const q = useAgentNormSettings(true);
  const save = useSaveAgentNormSettings();
  const [d, setD] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickId, setPickId] = useState("");
  const [ovOpen, setOvOpen] = useState("");
  const [ovClosed, setOvClosed] = useState("");
  const [ovMin, setOvMin] = useState("");
  const [ovHalf, setOvHalf] = useState("");
  const [ovFrom, setOvFrom] = useState("");
  const [ovOn, setOvOn] = useState(true);
  const [search, setSearch] = useState("");
  const [ruleRole, setRuleRole] = useState("supervisor");
  const [ruleUser, setRuleUser] = useState("");
  const [ruleN, setRuleN] = useState("3");
  const [ruleMode, setRuleMode] = useState<LeaderMinusMode>("per_agent");

  const empQ = useQueryAgents(tenantSlug);

  useEffect(() => {
    if (q.data) setD(toDraft(q.data));
  }, [q.data]);

  const agents = useMemo(() => (empQ.data ?? []).filter((e) => isAgent(e.role)), [empQ.data]);
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const used = new Set((d?.overrides ?? []).map((o) => o.user_id));
  const freeAgents = agents.filter((a) => !used.has(a.id));

  const openAmount = d ? parseNormSum(d.open) : 0;
  const closedAmount = d ? parseNormSum(d.closed) : 0;

  function payload() {
    if (!d) return null;
    return {
      enabled: d.enabled,
      start_date: d.start_date,
      open_amount: openAmount,
      closed_amount: closedAmount,
      min_orders: Math.max(0, Number(d.min_orders) || 0),
      half_day_ratio: Math.min(1, Math.max(0, (Number(d.half_pct) || 0) / 100)),
      overrides: d.overrides,
      leader_rules: d.leader_rules
    };
  }

  async function submit(comment?: string) {
    const body = payload();
    if (!body) return;
    if (body.open_amount <= 0 || body.closed_amount <= 0) return setError("Укажите обе суммы общей нормы больше нуля.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.start_date)) return setError("Укажите дату начала общей нормы.");
    setError(null);
    try {
      await save.mutateAsync({ ...body, comment });
      setMsg("Норматив сохранён — табель агентов пересчитается по новым условиям.");
    } catch (e) {
      setError(getUserFacingError(e, "Не удалось сохранить норматив."));
    }
  }

  function addOverride() {
    const id = Number(pickId);
    if (!d || !id || used.has(id)) return;
    const row: AgentNormOverride = { user_id: id, enabled: ovOn };
    if (ovFrom) row.start_date = ovFrom;
    if (parseNormSum(ovOpen) > 0) row.open_amount = parseNormSum(ovOpen);
    if (parseNormSum(ovClosed) > 0) row.closed_amount = parseNormSum(ovClosed);
    if (Number(ovMin) > 0) row.min_orders = Math.floor(Number(ovMin));
    if (Number(ovHalf) > 0) row.half_day_ratio = Math.min(1, Number(ovHalf) / 100);
    setD({ ...d, overrides: [...d.overrides, row] });
    setPickId("");
    setOvOpen("");
    setOvClosed("");
    setOvMin("");
    setOvHalf("");
    setOvFrom("");
    setOvOn(true);
  }

  function patchOverride(userId: number, patch: Partial<AgentNormOverride>) {
    if (!d) return;
    setD({
      ...d,
      overrides: d.overrides.map((o) => (o.user_id === userId ? { ...o, ...patch } : o))
    });
  }

  function addLeaderRule() {
    if (!d) return;
    const threshold = Math.min(31, Math.max(1, Math.floor(Number(ruleN) || 0)));
    const userId = ruleUser ? Number(ruleUser) : null;
    const dup = d.leader_rules.some((r) =>
      userId != null ? r.user_id === userId : r.user_id == null && r.role === ruleRole
    );
    if (dup) {
      setError(userId != null ? "Для этого аккаунта правило уже задано." : "Для этой роли правило уже задано. Можно добавить отдельное правило на аккаунт.");
      return;
    }
    setError(null);
    setD({
      ...d,
      leader_rules: [
        ...d.leader_rules,
        {
          id: `lr-${Date.now().toString(36)}`.slice(0, 40),
          enabled: true,
          role: ruleRole,
          user_id: userId,
          threshold,
          mode: ruleMode
        }
      ]
    });
  }

  const staff = empQ.data ?? [];
  const roleOptions = Object.entries(TIMESHEET_ROLE_LABELS);
  const accountsForRole = staff.filter((e) => e.role.trim().toLowerCase() === ruleRole);

  const filtered = agents.filter((a) => {
    const qv = search.trim().toLowerCase();
    if (!qv) return true;
    return `${a.fio} ${a.login} ${a.branch ?? ""} ${a.code ?? ""}`.toLowerCase().includes(qv);
  });

  if (!d) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{q.isError ? "Нет доступа к нормативу" : "Загрузка..."}</p>;
  }

  return (
    <div className="tabel-theme space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Target className="size-6 text-primary" /> Норматив агентов
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Авто-табель по дневным продажам: общая норма для всех и отдельные условия для выбранных агентов.
            Сумма дня = заказы − отказы − возвраты. Ручная правка в табеле важнее автоматики.
          </p>
        </div>
        {canEdit ? (
          <Button className="ml-auto" size="sm" disabled={save.isPending} onClick={() => void submit()}>
            <Save className="mr-1.5 size-4" /> Сохранить всё
          </Button>
        ) : null}
      </div>
      {msg ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{msg}</div> : null}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Общая норма (для всех агентов)</h2>
        <div
          className={cn(
            "mt-3 flex items-start gap-3 rounded-xl border p-3",
            d.enabled ? "border-primary/40 bg-primary/5" : "border-input bg-muted/30"
          )}
        >
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={d.enabled} disabled={!canEdit} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
            Расчёт по нормативу {d.enabled ? "включён" : "выключен"}
          </label>
          <span className="text-xs text-muted-foreground">
            {d.enabled ? "День отмечается автоматически: норма есть — «1», нет — «0»." : "Табель считается по GPS-визитам, кроме агентов с особым включённым условием."}
          </span>
        </div>
        <div className={cn("mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6", !d.enabled && "opacity-80")}>
          <Field label="Действует с">
            <Input type="date" className="h-9" value={d.start_date} disabled={!canEdit} onChange={(e) => setD({ ...d, start_date: e.target.value })} />
          </Field>
          <Field label="Консигнация открыта">
            <div className="relative">
              <LockOpen className="absolute left-2 top-2.5 size-3.5 text-emerald-600" />
              <Input className="h-9 pl-7 pr-10 text-right font-mono font-bold" value={d.open} disabled={!canEdit} onChange={(e) => setD({ ...d, open: fmtNormSum(parseNormSum(e.target.value)) })} />
              <span className="absolute right-2 top-2 text-xs text-muted-foreground">сум</span>
            </div>
          </Field>
          <Field label="Консигнация закрыта">
            <div className="relative">
              <Lock className="absolute left-2 top-2.5 size-3.5 text-amber-600" />
              <Input className="h-9 pl-7 pr-10 text-right font-mono font-bold" value={d.closed} disabled={!canEdit} onChange={(e) => setD({ ...d, closed: fmtNormSum(parseNormSum(e.target.value)) })} />
              <span className="absolute right-2 top-2 text-xs text-muted-foreground">сум</span>
            </div>
          </Field>
          <Field label="Мин. заказов за день">
            <Input type="number" min={0} className="h-9" value={d.min_orders} disabled={!canEdit} onChange={(e) => setD({ ...d, min_orders: e.target.value })} />
          </Field>
          <Field label="Полдня от % нормы">
            <Input type="number" min={0} max={100} className="h-9" value={d.half_pct} disabled={!canEdit} onChange={(e) => setD({ ...d, half_pct: e.target.value })} />
          </Field>
          <div className="flex items-end text-[11px] text-muted-foreground">
            <CalendarDays className="mr-1 size-3.5" /> 0 = условие выкл.
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Дополнительное условие: минус руководителю</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Считаются дни «0» у агентов, прикреплённых к руководителю. Если условие выполняется, руководителю ставится один минус.
          День минуса — день, когда набрался порог. Если в этот день минус уже стоит, он переносится на ближайший предыдущий свободный день, и в ячейку пишется комментарий.
          Ручная отметка в табеле не перезаписывается.
        </p>
        <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-4 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">По каждому агенту.</span> У одного агента минусов не меньше порога — руководителю один минус.
            Пример: порог 3, у агентов 2, 1 и 3 минуса — руководителю один минус, потому что третий агент набрал 3. У кого 2 и 1 — минус руководителю не дают.
          </li>
          <li>
            <span className="font-semibold text-foreground">По сумме всех агентов.</span> Минусы всех агентов складываются. Каждые N минусов дают руководителю ещё один минус.
          </li>
          <li>
            Правило на всю роль действует на всех с этой ролью. Правило на конкретный аккаунт важнее правила роли.
          </li>
        </ul>
        {canEdit ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Роль">
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={ruleRole} onChange={(e) => { setRuleRole(e.target.value); setRuleUser(""); }}>
                {roleOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Аккаунт">
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={ruleUser} onChange={(e) => setRuleUser(e.target.value)}>
                <option value="">Вся роль</option>
                {accountsForRole.map((a) => (
                  <option key={a.id} value={a.id}>{a.fio}</option>
                ))}
              </select>
            </Field>
            <Field label="Сколько минусов">
              <Input type="number" min={1} max={31} className="h-9" value={ruleN} onChange={(e) => setRuleN(e.target.value)} />
            </Field>
            <Field label="Как считать">
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={ruleMode} onChange={(e) => setRuleMode(e.target.value as LeaderMinusMode)}>
                <option value="per_agent">По каждому агенту</option>
                <option value="team_sum">По сумме всех агентов</option>
              </select>
            </Field>
            <div className="flex items-end">
              <Button size="sm" variant="outline" onClick={addLeaderRule}>
                <Plus className="mr-1 size-3.5" /> Добавить условие
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Кому</th>
                <th className="px-2 py-2">Порог</th>
                <th className="px-2 py-2">Как считать</th>
                <th className="px-2 py-2">Вкл</th>
                <th className="px-2 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.leader_rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                    Условие не задано — руководителю минус по агентам не ставится.
                  </td>
                </tr>
              ) : (
                d.leader_rules.map((r) => {
                  const person = r.user_id != null ? staff.find((e) => e.id === r.user_id) : null;
                  return (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-semibold">
                        {person ? person.fio : TIMESHEET_ROLE_LABELS[r.role] ?? r.role}
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {person ? `только этот аккаунт · ${TIMESHEET_ROLE_LABELS[r.role] ?? r.role}` : "вся роль"}
                        </div>
                      </td>
                      <td className="px-2 py-2 font-mono">{r.threshold}</td>
                      <td className="px-2 py-2">{r.mode === "team_sum" ? "сумма всех агентов" : "каждый агент отдельно"}</td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          disabled={!canEdit}
                          checked={r.enabled}
                          onChange={(e) =>
                            setD({
                              ...d,
                              leader_rules: d.leader_rules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x))
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        {canEdit ? (
                          <Button size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => setD({ ...d, leader_rules: d.leader_rules.filter((x) => x.id !== r.id) })}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <UserPlus className="size-4 text-primary" /> Особые условия для отдельных агентов
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Пустое поле = общая норма. Можно задать свои суммы, дату, минимум заказов, порог полдня или отключить норматив (табель по GPS).
        </p>
        {canEdit ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            <Field label="Агент">
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={pickId} onChange={(e) => setPickId(e.target.value)}>
                <option value="">Выберите агента…</option>
                {freeAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.fio}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Открыта (сум)">
              <Input className="h-9 font-mono" placeholder={d.open} value={ovOpen} onChange={(e) => setOvOpen(e.target.value)} />
            </Field>
            <Field label="Закрыта (сум)">
              <Input className="h-9 font-mono" placeholder={d.closed} value={ovClosed} onChange={(e) => setOvClosed(e.target.value)} />
            </Field>
            <Field label="Мин. зак.">
              <Input type="number" min={0} className="h-9" placeholder={d.min_orders} value={ovMin} onChange={(e) => setOvMin(e.target.value)} />
            </Field>
            <Field label="Полдня %">
              <Input type="number" min={0} max={100} className="h-9" placeholder={d.half_pct} value={ovHalf} onChange={(e) => setOvHalf(e.target.value)} />
            </Field>
            <Field label="С даты">
              <Input type="date" className="h-9" value={ovFrom} onChange={(e) => setOvFrom(e.target.value)} />
            </Field>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={ovOn} onChange={(e) => setOvOn(e.target.checked)} /> По норме
              </label>
              <Button size="sm" variant="outline" disabled={!pickId} onClick={addOverride}>
                <Plus className="mr-1 size-3.5" /> Добавить
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Агент</th>
                <th className="px-2 py-2">Открыта</th>
                <th className="px-2 py-2">Закрыта</th>
                <th className="px-2 py-2">Мин. зак.</th>
                <th className="px-2 py-2">Полдня</th>
                <th className="px-2 py-2">С даты</th>
                <th className="px-2 py-2">Режим</th>
                <th className="px-2 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.overrides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                    Пока нет особых условий — все агенты идут по общей норме.
                  </td>
                </tr>
              ) : (
                d.overrides.map((o) => {
                  const emp = byId.get(o.user_id);
                  return (
                    <tr key={o.user_id}>
                      <td className="px-2 py-2 font-semibold">
                        {emp?.fio ?? `ID ${o.user_id}`}
                        <div className="text-[11px] font-normal text-muted-foreground">{agentBranchLabel(emp?.branch)}</div>
                      </td>
                      <td className="px-2 py-2 font-mono">{o.open_amount != null ? `${fmtNormSum(o.open_amount)}` : "общая"}</td>
                      <td className="px-2 py-2 font-mono">{o.closed_amount != null ? `${fmtNormSum(o.closed_amount)}` : "общая"}</td>
                      <td className="px-2 py-2">{o.min_orders != null ? o.min_orders : "общая"}</td>
                      <td className="px-2 py-2">{o.half_day_ratio ? `${Math.round(o.half_day_ratio * 100)}%` : "общая"}</td>
                      <td className="px-2 py-2">{o.start_date ?? "общая"}</td>
                      <td className="px-2 py-2">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            checked={o.enabled !== false}
                            onChange={(e) => patchOverride(o.user_id, { enabled: e.target.checked })}
                          />
                          {o.enabled === false ? "GPS" : "норма"}
                        </label>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {canEdit ? (
                          <Button size="sm" variant="ghost" className="h-7 text-rose-600" onClick={() => setD({ ...d, overrides: d.overrides.filter((x) => x.user_id !== o.user_id) })}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold">Все агенты и действующая норма</h2>
          <Input className="ml-auto h-8 max-w-xs" placeholder="Поиск агента…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Агент</th>
                <th className="px-2 py-2">Филиал</th>
                <th className="px-2 py-2">Открыта / закрыта</th>
                <th className="px-2 py-2">Доп. условия</th>
                <th className="px-2 py-2">Источник</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((a) => {
                const o = d.overrides.find((x) => x.user_id === a.id);
                const on = Boolean(o?.enabled ?? d.enabled);
                const open = o?.open_amount ?? openAmount;
                const closed = o?.closed_amount ?? closedAmount;
                const min = o?.min_orders ?? (Number(d.min_orders) || 0);
                const half = o?.half_day_ratio ?? ((Number(d.half_pct) || 0) / 100);
                return (
                  <tr key={a.id}>
                    <td className="px-2 py-2 font-semibold">{a.fio}</td>
                    <td className="px-2 py-2 text-muted-foreground">{agentBranchLabel(a.branch)}</td>
                    <td className="px-2 py-2 font-mono">{on ? `${fmtNormSum(open)} / ${fmtNormSum(closed)}` : "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {on ? [min > 0 ? `мин. ${min} зак.` : null, half > 0 ? `полдня ${Math.round(half * 100)}%` : null].filter(Boolean).join(" · ") || "нет" : "табель по GPS"}
                    </td>
                    <td className="px-2 py-2">
                      {o ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">особое</span> : <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">общая</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function useQueryAgents(tenantSlug: string | null) {
  return useQuery({
    queryKey: ["timesheet", "filters", "agents", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { employees: Emp[] } }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data.employees ?? [];
    }
  });
}
