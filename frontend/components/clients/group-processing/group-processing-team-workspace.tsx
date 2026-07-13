"use client";

import { GROUP_PROCESSING_IDS_STORAGE_KEY } from "@/components/clients/group-processing/group-processing-actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { orderAgentFilterOption, orderExpeditorFilterOption } from "@/lib/order-picker-labels";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const MAX_TEAMS = 10;
const VISIT_DAYS = [
  { k: 1, l: "Пн", weekend: false },
  { k: 2, l: "Вт", weekend: false },
  { k: 3, l: "Ср", weekend: false },
  { k: 4, l: "Чт", weekend: false },
  { k: 5, l: "Пт", weekend: false },
  { k: 6, l: "Сб", weekend: true },
  { k: 7, l: "Вс", weekend: true }
] as const;

type ShowField =
  | "phone"
  | "inn"
  | "address"
  | "category"
  | "city"
  | "zone"
  | "client_code"
  | "legal_name";

const SHOW_OPTIONS: { value: ShowField; label: string }[] = [
  { value: "phone", label: "Телефон" },
  { value: "inn", label: "ИНН" },
  { value: "address", label: "Адрес" },
  { value: "category", label: "Категория" },
  { value: "city", label: "Город" },
  { value: "zone", label: "Зона" },
  { value: "client_code", label: "Код" },
  { value: "legal_name", label: "Юр. название" }
];

const SHOW_STORAGE_KEY = "salec:gp-show:team";

type TeamSlot = {
  agentId: string;
  expeditorUserId: string;
  weekdays: number[];
};

type ClientsResponse = {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
};

function emptySlot(): TeamSlot {
  return { agentId: "", expeditorUserId: "", weekdays: [] };
}

function slotHasData(s: TeamSlot): boolean {
  return s.agentId !== "" || s.expeditorUserId !== "" || s.weekdays.length > 0;
}

/** Bir klientda bir agent faqat bitta yo‘nalishda bo‘lishi mumkin. */
function findDuplicateAgentDirections(slots: TeamSlot[]): { agentId: string; indices: number[] } | null {
  const map = new Map<string, number[]>();
  slots.forEach((s, i) => {
    if (!s.agentId) return;
    const list = map.get(s.agentId) ?? [];
    list.push(i);
    map.set(s.agentId, list);
  });
  for (const [agentId, indices] of map) {
    if (indices.length > 1) return { agentId, indices };
  }
  return null;
}

function agentUsedOnOtherDirection(slots: TeamSlot[], teamIdx: number, agentId: string): boolean {
  if (!agentId) return false;
  return slots.some((s, i) => i !== teamIdx && s.agentId === agentId);
}

function slotsFromClient(c: ClientRow): TeamSlot[] {
  const list = Array.isArray(c.agent_assignments) ? [...c.agent_assignments].sort((a, b) => a.slot - b.slot) : [];
  const rows: TeamSlot[] = [];
  for (const a of list) {
    const wd = Array.isArray(a.visit_weekdays) ? a.visit_weekdays.filter((x) => x >= 1 && x <= 7) : [];
    if (a.agent_id == null && a.expeditor_user_id == null && wd.length === 0) continue;
    rows.push({
      agentId: a.agent_id != null ? String(a.agent_id) : "",
      expeditorUserId: a.expeditor_user_id != null ? String(a.expeditor_user_id) : "",
      weekdays: wd
    });
  }
  if (rows.length === 0 && c.agent_id != null) {
    rows.push({ agentId: String(c.agent_id), expeditorUserId: "", weekdays: [] });
  }
  return rows.length ? rows : [emptySlot()];
}

function showValue(c: ClientRow, field: ShowField): string {
  const v = c[field];
  if (v == null || String(v).trim() === "") return "—";
  return String(v);
}

function parseIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ].slice(0, 500);
}

function loadStoredIds(): number[] {
  try {
    const raw = sessionStorage.getItem(GROUP_PROCESSING_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500);
  } catch {
    return [];
  }
}

function parseOptionalPositiveId(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function slotToApi(s: TeamSlot, slot: number) {
  return {
    slot,
    agent_id: parseOptionalPositiveId(s.agentId),
    expeditor_user_id: parseOptionalPositiveId(s.expeditorUserId),
    visit_weekdays: s.weekdays.filter((d) => d >= 1 && d <= 7),
    visit_date: null as string | null,
    expeditor_phone: null as string | null
  };
}

export function GroupProcessingTeamWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const seedIds = useMemo(() => {
    const fromQ = parseIds(searchParams.get("ids"));
    if (fromQ.length) return fromQ;
    return loadStoredIds();
  }, [searchParams]);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(seedIds));
  const [teamCount, setTeamCount] = useState(1);
  const [draftByClient, setDraftByClient] = useState<Record<number, TeamSlot[]>>({});
  const [master, setMaster] = useState<TeamSlot[]>(() => [emptySlot()]);
  const [showField, setShowField] = useState<ShowField>(() => {
    try {
      const v = localStorage.getItem(SHOW_STORAGE_KEY) as ShowField | null;
      if (v && SHOW_OPTIONS.some((o) => o.value === v)) return v;
    } catch {
      /* ignore */
    }
    return "phone";
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const clientsQ = useQuery({
    queryKey: ["clients", "gp-team", tenantSlug, seedIds.join(","), search],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      if (seedIds.length > 0) {
        const params = new URLSearchParams({ page: "1", limit: String(Math.min(500, seedIds.length)) });
        params.set("client_ids", seedIds.join(","));
        if (search.trim()) params.set("search", search.trim());
        const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
        const byId = new Map(data.data.map((c) => [c.id, c]));
        const ordered = seedIds.map((id) => byId.get(id)).filter(Boolean) as ClientRow[];
        return { data: ordered, total: ordered.length };
      }
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${params}`);
      return { data: data.data, total: data.total };
    }
  });

  const rows = clientsQ.data?.data ?? [];

  useEffect(() => {
    if (!rows.length) return;
    setDraftByClient((prev) => {
      const next = { ...prev };
      let maxTeams = teamCount;
      for (const c of rows) {
        if (!next[c.id]) {
          const slots = slotsFromClient(c);
          next[c.id] = slots;
          maxTeams = Math.max(maxTeams, slots.length);
        }
      }
      if (maxTeams > teamCount) {
        setTeamCount(maxTeams);
        setMaster((m) => {
          const copy = [...m];
          while (copy.length < maxTeams) copy.push(emptySlot());
          return copy;
        });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat yangi qatorlar kelganda init
  }, [rows]);

  useEffect(() => {
    try {
      localStorage.setItem(SHOW_STORAGE_KEY, showField);
    } catch {
      /* ignore */
    }
  }, [showField]);

  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "gp-team", "active"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; name?: string; fio?: string; login: string; is_active?: boolean }>;
      }>(`/api/${tenantSlug}/agents?is_active=true`);
      return (data.data ?? [])
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          id: u.id,
          name: (u.name ?? u.fio ?? "").trim() || u.login,
          login: u.login
        }));
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "gp-team", "active"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; name?: string; fio?: string; login: string; is_active?: boolean }>;
      }>(`/api/${tenantSlug}/expeditors?is_active=true`);
      return (data.data ?? [])
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          id: u.id,
          name: (u.name ?? u.fio ?? "").trim() || u.login,
          login: u.login
        }));
    }
  });

  const agentOpts = useMemo(
    () => (agentsQ.data ?? []).map((u) => orderAgentFilterOption(u)),
    [agentsQ.data]
  );
  const expeditorOpts = useMemo(
    () =>
      (expeditorsQ.data ?? []).map((u) =>
        orderExpeditorFilterOption({ id: u.id, fio: u.name, login: u.login })
      ),
    [expeditorsQ.data]
  );

  const ensureClientSlots = useCallback(
    (clientId: number): TeamSlot[] => {
      const cur = draftByClient[clientId] ?? [emptySlot()];
      const next = [...cur];
      while (next.length < teamCount) next.push(emptySlot());
      return next.slice(0, teamCount);
    },
    [draftByClient, teamCount]
  );

  const patchClientSlot = (clientId: number, teamIdx: number, patch: Partial<TeamSlot>) => {
    setDraftByClient((prev) => {
      const slots = [...(prev[clientId] ?? [emptySlot()])];
      while (slots.length < teamCount) slots.push(emptySlot());
      const nextSlot = { ...slots[teamIdx]!, ...patch };
      if (patch.agentId !== undefined && patch.agentId !== "") {
        if (agentUsedOnOtherDirection(slots, teamIdx, patch.agentId)) {
          setStatusMsg(
            `Klient #${clientId}: bu agent boshqa yo‘nalishda allaqachon bog‘langan. Bir yo‘nalish = bitta agent.`
          );
          return prev;
        }
      }
      slots[teamIdx] = nextSlot;
      return { ...prev, [clientId]: slots };
    });
  };

  const patchMaster = (teamIdx: number, patch: Partial<TeamSlot>) => {
    setMaster((prev) => {
      const next = [...prev];
      while (next.length < teamCount) next.push(emptySlot());
      next[teamIdx] = { ...next[teamIdx]!, ...patch };
      return next;
    });
  };

  const applyMasterToSelected = (teamIdx: number) => {
    const m = master[teamIdx] ?? emptySlot();
    const targets = selectedIds.size ? selectedIds : new Set(rows.map((r) => r.id));
    let applied = 0;
    let skipped = 0;
    const nextDraft: Record<number, TeamSlot[]> = { ...draftByClient };
    for (const id of targets) {
      const slots = [...(nextDraft[id] ?? [emptySlot()])];
      while (slots.length < teamCount) slots.push(emptySlot());
      if (m.agentId && agentUsedOnOtherDirection(slots, teamIdx, m.agentId)) {
        skipped += 1;
        continue;
      }
      slots[teamIdx] = {
        agentId: m.agentId,
        expeditorUserId: m.expeditorUserId,
        weekdays: [...m.weekdays]
      };
      nextDraft[id] = slots;
      applied += 1;
    }
    setDraftByClient(nextDraft);
    setStatusMsg(
      skipped > 0
        ? `Направление ${teamIdx + 1}: ${applied} ta qo‘llandi, ${skipped} ta o‘tkazib yuborildi (agent boshqa yo‘nalishda bor)`
        : `Направление ${teamIdx + 1}: ${applied} ta klientga qo‘llandi (saqlash kerak)`
    );
  };

  const addTeam = () => {
    if (teamCount >= MAX_TEAMS) return;
    const n = teamCount + 1;
    setTeamCount(n);
    setMaster((m) => [...m, emptySlot()]);
    setDraftByClient((prev) => {
      const next: Record<number, TeamSlot[]> = {};
      for (const [id, slots] of Object.entries(prev)) {
        next[Number(id)] = [...slots, emptySlot()];
      }
      return next;
    });
  };

  const removeLastTeam = () => {
    if (teamCount <= 1) return;
    const n = teamCount - 1;
    setTeamCount(n);
    setMaster((m) => m.slice(0, n));
    setDraftByClient((prev) => {
      const next: Record<number, TeamSlot[]> = {};
      for (const [id, slots] of Object.entries(prev)) {
        next[Number(id)] = slots.slice(0, n);
      }
      return next;
    });
  };

  const toggleSelectAll = (on: boolean) => {
    if (on) setSelectedIds(new Set(rows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("No tenant");
      const targets = selectedIds.size ? [...selectedIds] : rows.map((r) => r.id);
      let ok = 0;
      const failed: string[] = [];
      for (const id of targets) {
        const allSlots = ensureClientSlots(id);
        const dup = findDuplicateAgentDirections(allSlots);
        if (dup) {
          failed.push(`#${id}: bir agent bir necha yo‘nalishda (faqat bitta ruxsat)`);
          continue;
        }
        const slots = allSlots.filter(slotHasData);
        if (slots.length === 0) {
          failed.push(`#${id}: agent / dastavchik / kun tanlanmagan`);
          continue;
        }
        const badId = slots.find(
          (s) =>
            (s.agentId && parseOptionalPositiveId(s.agentId) == null) ||
            (s.expeditorUserId && parseOptionalPositiveId(s.expeditorUserId) == null)
        );
        if (badId) {
          failed.push(`#${id}: agent yoki dastavchik ID noto‘g‘ri`);
          continue;
        }
        const agent_assignments = slots.map((s, i) => slotToApi(s, i + 1));
        try {
          await api.patch(`/api/${tenantSlug}/clients/${id}`, { agent_assignments });
          ok += 1;
        } catch (e) {
          failed.push(`#${id}: ${getUserFacingError(e, "xato")}`);
        }
      }
      return { ok, failed };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["clients"] });
      if (res.ok > 0 && res.failed.length === 0) {
        router.push("/clients");
        return;
      }
      setStatusMsg(
        res.failed.length
          ? `Saqlandi: ${res.ok}. Xato: ${res.failed.slice(0, 3).join("; ")}`
          : `Saqlandi: ${res.ok} ta klient`
      );
    },
    onError: (e) => setStatusMsg(getUserFacingError(e, "Saqlashda xato"))
  });

  const selectClass =
    "h-8 w-full min-w-[8.5rem] max-w-[11rem] rounded border border-slate-300 bg-white px-1.5 text-[12px] text-slate-800";

  const renderWeekdays = (weekdays: number[], onToggle: (day: number) => void) => (
    <div className="flex flex-nowrap items-center gap-x-1 gap-y-0.5">
      {VISIT_DAYS.map((d) => {
        const on = weekdays.includes(d.k);
        return (
          <label
            key={d.k}
            className={cn(
              "inline-flex cursor-pointer items-center gap-0.5 whitespace-nowrap text-[11px]",
              d.weekend && "text-red-600"
            )}
          >
            <input
              type="checkbox"
              className="size-3.5 accent-blue-600"
              checked={on}
              onChange={() => onToggle(d.k)}
            />
            {d.l}
          </label>
        );
      })}
    </div>
  );

  /** Bitta yo‘nalish = 3 ta yonma-yon ustun: Агент | Доставщик | Визиты */
  const renderDirectionCells = (
    slots: TeamSlot[],
    onChange: (teamIdx: number, patch: Partial<TeamSlot>) => void,
    opts?: { master?: boolean }
  ) =>
    Array.from({ length: teamCount }, (_, teamIdx) => {
      const s = slots[teamIdx] ?? emptySlot();
      const border = teamIdx === 0 ? "border-l-2 border-l-slate-300" : "border-l border-l-slate-200";
      const toggleDay = (day: number) => {
        const set = new Set(s.weekdays);
        if (set.has(day)) set.delete(day);
        else set.add(day);
        onChange(teamIdx, { weekdays: [...set].sort((a, b) => a - b) });
      };
      const takenAgents = new Set(
        slots.map((x, i) => (i !== teamIdx && x.agentId ? x.agentId : "")).filter(Boolean)
      );
      return (
        <Fragment key={teamIdx}>
          <td className={cn("px-2 py-2 align-middle", border)}>
            <select
              className={selectClass}
              value={s.agentId}
              onChange={(e) => onChange(teamIdx, { agentId: e.target.value })}
              aria-label={`Направление ${teamIdx + 1}: агент`}
            >
              <option value="">—</option>
              {agentOpts.map((o) => {
                const taken = !opts?.master && takenAgents.has(o.value) && o.value !== s.agentId;
                return (
                  <option key={o.value} value={o.value} disabled={taken}>
                    {taken ? `${o.label} (boshqa yo‘nalishda)` : o.label}
                  </option>
                );
              })}
            </select>
            {opts?.master ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-1 h-6 w-full max-w-[11rem] text-[10px]"
                onClick={() => applyMasterToSelected(teamIdx)}
              >
                Qo‘llash
              </Button>
            ) : null}
          </td>
          <td className="border-l border-slate-100 px-2 py-2 align-middle">
            <select
              className={selectClass}
              value={s.expeditorUserId}
              onChange={(e) => onChange(teamIdx, { expeditorUserId: e.target.value })}
              aria-label={`Направление ${teamIdx + 1}: доставщик`}
            >
              <option value="">—</option>
              {expeditorOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </td>
          <td className="border-l border-slate-100 px-2 py-2 align-middle">
            {renderWeekdays(s.weekdays, toggleDay)}
          </td>
        </Fragment>
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            Прикрепление и открепление агентов к клиентам
          </h1>
          <p className="text-sm text-muted-foreground">
            Количество клиентов: <b>{rows.length}</b>
            {selectedIds.size ? (
              <>
                {" "}
                · выбрано: <b>{selectedIds.size}</b>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Shart: har bir yo‘nalishda klientga faqat <b>bitta</b> agent; bir xil agent boshqa yo‘nalishda
            takrorlanmaydi.
          </p>
          {statusMsg ? <p className="mt-1 text-sm text-emerald-700">{statusMsg}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/clients" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Вернуться обратно
          </Link>
          <Button
            type="button"
            size="sm"
            disabled={saveMut.isPending || !rows.length}
            onClick={() => saveMut.mutate()}
          >
            <Save className="mr-1.5 size-3.5" />
            {saveMut.isPending ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Поиск</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон…"
            className="h-9"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Показать (3-я колонка)</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={showField}
            onChange={(e) => setShowField(e.target.value as ShowField)}
          >
            {SHOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectAll(true)}>
          Выбрать всех
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => toggleSelectAll(false)}>
          Снять выбор
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={teamCount >= MAX_TEAMS} onClick={addTeam}>
          <Plus className="mr-1 size-3.5" />
          Добавить направление
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={teamCount <= 1}
          onClick={removeLastTeam}
          title="Удалить последнее направление"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {clientsQ.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
        ) : !rows.length ? (
          <div className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>Нет клиентов. Сначала выберите клиентов в списке или откройте обработку с ids.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => router.push("/clients")}>
              К списку клиентов
            </Button>
          </div>
        ) : (
          <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th rowSpan={2} className="w-10 px-2 py-2 align-middle">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-blue-600"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th rowSpan={2} className="w-16 px-2 py-2 align-middle">
                  ID
                </th>
                <th rowSpan={2} className="min-w-[10rem] px-2 py-2 align-middle">
                  Клиент
                </th>
                <th rowSpan={2} className="min-w-[8rem] px-2 py-2 align-middle">
                  Показать
                  <div className="mt-0.5 text-[10px] font-normal normal-case text-slate-400">
                    {SHOW_OPTIONS.find((o) => o.value === showField)?.label}
                  </div>
                </th>
                {Array.from({ length: teamCount }, (_, i) => (
                  <th
                    key={i}
                    colSpan={3}
                    className={cn(
                      "px-2 py-2 text-center",
                      i === 0 ? "border-l-2 border-l-slate-300" : "border-l border-l-slate-200",
                      i % 2 === 0 ? "bg-sky-50/80" : "bg-violet-50/70"
                    )}
                  >
                    Направление {i + 1}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {Array.from({ length: teamCount }, (_, i) => (
                  <Fragment key={i}>
                    <th
                      className={cn(
                        "px-2 py-1.5 font-medium normal-case",
                        i === 0 ? "border-l-2 border-l-slate-300" : "border-l border-l-slate-200",
                        i % 2 === 0 ? "bg-sky-50/50" : "bg-violet-50/40"
                      )}
                    >
                      Выберите агента
                    </th>
                    <th
                      className={cn(
                        "border-l border-slate-100 px-2 py-1.5 font-medium normal-case",
                        i % 2 === 0 ? "bg-sky-50/50" : "bg-violet-50/40"
                      )}
                    >
                      Доставщик
                    </th>
                    <th
                      className={cn(
                        "border-l border-slate-100 px-2 py-1.5 font-medium normal-case",
                        i % 2 === 0 ? "bg-sky-50/50" : "bg-violet-50/40"
                      )}
                    >
                      Настройте визиты
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 bg-emerald-50/60">
                <td className="px-2 py-2" colSpan={4}>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Общая строка (для выбранных)
                  </span>
                </td>
                {renderDirectionCells(master, patchMaster, { master: true })}
              </tr>
              {rows.map((c, idx) => {
                const slots = ensureClientSlots(c.id);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b border-slate-100",
                      idx % 2 === 1 ? "bg-slate-50/80" : "bg-white",
                      selectedIds.has(c.id) && "bg-amber-50/70"
                    )}
                  >
                    <td className="px-2 py-2 align-middle">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-blue-600"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleRow(c.id)}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle font-mono text-[12px] text-slate-600">{c.id}</td>
                    <td className="px-2 py-2 align-middle font-medium text-slate-800">{c.name}</td>
                    <td className="px-2 py-2 align-middle text-slate-600">{showValue(c, showField)}</td>
                    {renderDirectionCells(slots, (teamIdx, patch) => patchClientSlot(c.id, teamIdx, patch))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
