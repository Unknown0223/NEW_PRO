import type { ClientRow } from "@/lib/client-types";

export type ClientAuditLogRow = {
  id: number;
  action: string;
  detail: unknown;
  user_login: string | null;
  created_at: string;
};

export type ClientHistoryFilter =
  | "ALL"
  | "CREATE"
  | "TEAM"
  | "AGENT"
  | "EXPEDITOR"
  | "TERRITORY"
  | "STATUS"
  | "OTHER";

export type ClientFieldChange = {
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
};

export type ClientHistoryEntry = {
  id: number;
  date: string;
  user: string;
  filter: ClientHistoryFilter;
  action: string;
  title: string;
  changes: ClientFieldChange[];
};

export type ClientTeamSnapshot = {
  agent: string | null;
  agentDays: string | null;
  expeditor: string | null;
  empty?: boolean;
};

export type ClientAuditSnapshotColumn = {
  id: number;
  date: string;
  values: Record<string, string>;
  team1: ClientTeamSnapshot | null;
  team2: ClientTeamSnapshot | null;
};

export type ClientAuditHistoryViewModel = {
  clientName: string;
  territory: string;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
  history: ClientHistoryEntry[];
  snapshots: ClientAuditSnapshotColumn[];
};

export const CLIENT_AUDIT_FIELD_ROWS: { key: string; label: string }[] = [
  { key: "name", label: "Названия" },
  { key: "firmName", label: "Название фирмы" },
  { key: "address", label: "Адрес" },
  { key: "landmark", label: "Ориентир" },
  { key: "phone", label: "Телефон" },
  { key: "contactPerson", label: "Контактное лицо" },
  { key: "inn", label: "ИНН" },
  { key: "pinfl", label: "ПИНФЛ" },
  { key: "comment", label: "Комментарий" },
  { key: "code", label: "Код" },
  { key: "contractNumber", label: "Номер договора" },
  { key: "account", label: "Аккаунт" },
  { key: "bank", label: "Банк" },
  { key: "mfo", label: "МФО" },
  { key: "oked", label: "ОКЭД" },
  { key: "vatCode", label: "Регистрационный код плательщика НДС" },
  { key: "clientDegree", label: "Степень клиента" },
  { key: "changedBy", label: "Кто изменил" },
  { key: "clientType", label: "Тип клиента" },
  { key: "salesChannel", label: "Канал продаж" },
  { key: "territory", label: "Территория" },
  { key: "clientCategory", label: "Категория клиента" },
  { key: "active", label: "Активный" }
];

const WEEKDAY_RU: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс"
};

const SCALAR_DETAIL_TO_SNAPSHOT: Record<string, string> = {
  name: "name",
  legal_name: "firmName",
  address: "address",
  landmark: "landmark",
  phone: "phone",
  inn: "inn",
  client_pinfl: "pinfl",
  notes: "comment",
  client_code: "code",
  contract_number: "contractNumber",
  bank_account: "account",
  bank_name: "bank",
  bank_mfo: "mfo",
  oked: "oked",
  vat_reg_code: "vatCode",
  category: "clientDegree",
  client_type_code: "clientType",
  sales_channel: "salesChannel",
  product_category_ref: "clientCategory",
  region: "territory",
  city: "territory",
  district: "territory",
  neighborhood: "territory",
  zone: "territory",
  is_active: "active"
};

const SNAPSHOT_LABEL_BY_KEY = new Map(CLIENT_AUDIT_FIELD_ROWS.map((r) => [r.key, r.label]));

type ReplayAssignment = {
  slot: number;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  expeditor_user_id: number | null;
  expeditor_name: string | null;
  expeditor_phone: string | null;
  visit_weekdays: number[];
  visit_date: string | null;
};

type ReplayState = {
  scalars: Record<string, string>;
  assignments: Map<number, ReplayAssignment>;
  territoryParts: {
    zone: string;
    city: string;
    region: string;
    district: string;
    neighborhood: string;
  };
};

const TERRITORY_DETAIL_KEYS = ["zone", "city", "region", "district", "neighborhood"] as const;

function territoryFromParts(parts: ReplayState["territoryParts"]): string {
  return [parts.zone, parts.city, parts.region, parts.district, parts.neighborhood]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(", ");
}

function syncTerritoryScalar(state: ReplayState): void {
  state.scalars.territory = territoryFromParts(state.territoryParts);
}

export const CLIENT_HISTORY_FILTER_META: Record<
  ClientHistoryFilter,
  { label: string; color: string; bg: string; ring: string; icon: string }
> = {
  ALL: { label: "Все", color: "text-slate-700", bg: "bg-slate-50", ring: "ring-slate-200", icon: "list" },
  CREATE: {
    label: "Создание",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: "plus"
  },
  TEAM: { label: "Команда", color: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", icon: "users" },
  AGENT: { label: "Агент", color: "text-violet-700", bg: "bg-violet-50", ring: "ring-violet-200", icon: "user" },
  EXPEDITOR: {
    label: "Экспедитор",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: "truck"
  },
  TERRITORY: {
    label: "Территория",
    color: "text-teal-700",
    bg: "bg-teal-50",
    ring: "ring-teal-200",
    icon: "map"
  },
  STATUS: { label: "Статус", color: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", icon: "toggle" },
  OTHER: { label: "Прочее", color: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200", icon: "list" }
};

export const CLIENT_HISTORY_FILTERS: { value: ClientHistoryFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "CREATE", label: "Создание" },
  { value: "TEAM", label: "Команда" },
  { value: "AGENT", label: "Агент" },
  { value: "EXPEDITOR", label: "Экспедитор" }
];

export const clientAuditAllQueryKey = (tenantSlug: string, clientId: number) =>
  ["client-audit", tenantSlug, clientId, "all"] as const;

export const clientAuditMetaQueryKey = (tenantSlug: string, clientId: number) =>
  ["client-audit-meta", tenantSlug, clientId] as const;

function detailRecord(d: unknown): Record<string, unknown> {
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return {};
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

function formatBool(v: unknown): string | null {
  if (v === true) return "Да";
  if (v === false) return "Нет";
  return null;
}

function formatWeekdays(wd: number[]): string | null {
  const uniq = Array.from(new Set(wd.filter((x) => x >= 1 && x <= 7))).sort((a, b) => a - b);
  if (!uniq.length) return null;
  return uniq.map((i) => WEEKDAY_RU[i] ?? String(i)).join(", ");
}

function emptyAssignment(slot: number): ReplayAssignment {
  return {
    slot,
    agent_id: null,
    agent_name: null,
    agent_code: null,
    expeditor_user_id: null,
    expeditor_name: null,
    expeditor_phone: null,
    visit_weekdays: [],
    visit_date: null
  };
}

function cloneState(state: ReplayState): ReplayState {
  return {
    scalars: { ...state.scalars },
    assignments: new Map(Array.from(state.assignments.entries()).map(([k, v]) => [k, { ...v }])),
    territoryParts: { ...state.territoryParts }
  };
}

function territoryFromClient(c: ClientRow): string {
  return [c.zone, c.city, c.region, c.district, c.neighborhood]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function contactPersonLine(c: ClientRow): string | null {
  const p = c.contact_persons?.[0];
  if (!p) return null;
  const name = [p.firstName, p.lastName].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  const phone = (p.phone ?? "").trim();
  if (name && phone) return `${name} · ${phone}`;
  return name || phone || null;
}

function addressLine(c: ClientRow): string | null {
  const parts = [c.address, c.street, c.house_number, c.apartment]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  return parts[0] ?? null;
}

function clientToReplayState(c: ClientRow): ReplayState {
  const territoryParts = {
    zone: c.zone ?? "",
    city: c.city ?? "",
    region: c.region ?? "",
    district: c.district ?? "",
    neighborhood: c.neighborhood ?? ""
  };
  const scalars: Record<string, string> = {
    name: c.name,
    firmName: c.legal_name ?? "",
    address: addressLine(c) ?? "",
    landmark: c.landmark ?? "",
    phone: c.phone ?? "",
    contactPerson: contactPersonLine(c) ?? "",
    inn: c.inn ?? "",
    pinfl: c.client_pinfl ?? "",
    comment: c.notes ?? "",
    code: c.client_code ?? "",
    contractNumber: c.contract_number ?? "",
    account: c.bank_account ?? "",
    bank: c.bank_name ?? "",
    mfo: c.bank_mfo ?? "",
    oked: c.oked ?? "",
    vatCode: c.vat_reg_code ?? "",
    clientDegree: c.category ?? "",
    clientType: c.client_type_code ?? "",
    salesChannel: c.sales_channel ?? "",
    territory: territoryFromParts(territoryParts),
    clientCategory: c.product_category_ref ?? c.category ?? "",
    active: c.is_active ? "Да" : "Нет"
  };
  const assignments = new Map<number, ReplayAssignment>();
  for (const a of c.agent_assignments ?? []) {
    assignments.set(a.slot, {
      slot: a.slot,
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      agent_code: a.agent_code ?? null,
      expeditor_user_id: a.expeditor_user_id,
      expeditor_name: a.expeditor_name,
      expeditor_phone: a.expeditor_phone,
      visit_weekdays: Array.isArray(a.visit_weekdays) ? [...a.visit_weekdays] : [],
      visit_date: a.visit_date
    });
  }
  return { scalars, assignments, territoryParts };
}

function enrichAssignmentFromClient(
  a: ReplayAssignment,
  client?: ClientRow | null
): ReplayAssignment {
  if (!client) return a;
  const cur = client.agent_assignments?.find((x) => x.slot === a.slot);
  if (!cur) return a;
  return {
    ...a,
    agent_name: a.agent_id != null && a.agent_id === cur.agent_id ? cur.agent_name ?? a.agent_name : a.agent_name,
    agent_code: a.agent_id != null && a.agent_id === cur.agent_id ? cur.agent_code ?? a.agent_code : a.agent_code,
    expeditor_name:
      a.expeditor_user_id != null && a.expeditor_user_id === cur.expeditor_user_id
        ? cur.expeditor_name ?? a.expeditor_name
        : a.expeditor_name,
    expeditor_phone: a.expeditor_phone ?? cur.expeditor_phone
  };
}

function applyDetail(state: ReplayState, detail: Record<string, unknown>, client?: ClientRow | null): ReplayState {
  const next = cloneState(state);

  for (const [detailKey, snapshotKey] of Object.entries(SCALAR_DETAIL_TO_SNAPSHOT)) {
    if (!(detailKey in detail)) continue;
    if (TERRITORY_DETAIL_KEYS.includes(detailKey as (typeof TERRITORY_DETAIL_KEYS)[number])) {
      const t = strOrNull(detail[detailKey]);
      next.territoryParts[detailKey as (typeof TERRITORY_DETAIL_KEYS)[number]] = t ?? "";
      syncTerritoryScalar(next);
      continue;
    }
    const raw = detail[detailKey];
    if (detailKey === "is_active") {
      const formatted = formatBool(raw);
      if (formatted) next.scalars[snapshotKey] = formatted;
      continue;
    }
    const t = strOrNull(raw);
    if (t != null) next.scalars[snapshotKey] = t;
    else if (raw === null) next.scalars[snapshotKey] = "";
  }

  if ("contact_persons" in detail && Array.isArray(detail.contact_persons)) {
    const slots = detail.contact_persons as Array<{
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
    }>;
    const p = slots[0];
    if (p) {
      const name = [p.firstName, p.lastName].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
      const phone = (p.phone ?? "").trim();
      next.scalars.contactPerson = name && phone ? `${name} · ${phone}` : name || phone || "";
    }
  }

  if ("agent_assignments" in detail && Array.isArray(detail.agent_assignments)) {
    for (const raw of detail.agent_assignments) {
      if (!raw || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      const slot = Number(rec.slot);
      if (!Number.isInteger(slot) || slot < 1) continue;
      const prev = next.assignments.get(slot) ?? emptyAssignment(slot);
      const merged: ReplayAssignment = {
        ...prev,
        slot,
        agent_id: "agent_id" in rec ? (rec.agent_id as number | null) : prev.agent_id,
        agent_name:
          "agent_id" in rec && rec.agent_id === null ? null : prev.agent_name,
        agent_code:
          "agent_id" in rec && rec.agent_id === null ? null : prev.agent_code,
        expeditor_user_id:
          "expeditor_user_id" in rec ? (rec.expeditor_user_id as number | null) : prev.expeditor_user_id,
        expeditor_name:
          "expeditor_user_id" in rec && rec.expeditor_user_id === null ? null : prev.expeditor_name,
        expeditor_phone:
          "expeditor_phone" in rec ? strOrNull(rec.expeditor_phone) : prev.expeditor_phone,
        visit_date: "visit_date" in rec ? strOrNull(rec.visit_date) : prev.visit_date,
        visit_weekdays:
          "visit_weekdays" in rec && Array.isArray(rec.visit_weekdays)
            ? (rec.visit_weekdays as number[])
            : prev.visit_weekdays
      };
      next.assignments.set(slot, enrichAssignmentFromClient(merged, client));
    }
  }

  return next;
}

function formatAssignmentAgent(a: ReplayAssignment): string | null {
  if (!a.agent_id && !a.agent_name && !a.agent_code) return null;
  const chunks: string[] = [];
  if (a.agent_code) chunks.push(a.agent_code);
  if (a.agent_name) chunks.push(a.agent_name);
  else if (a.agent_id) chunks.push(`#${a.agent_id}`);
  return chunks.join(" ") || null;
}

function teamSnapshot(a: ReplayAssignment | undefined): ClientTeamSnapshot | null {
  if (!a) return null;
  const agent = formatAssignmentAgent(a);
  const agentDays = formatWeekdays(a.visit_weekdays);
  const expeditor = a.expeditor_name ?? (a.expeditor_user_id ? `#${a.expeditor_user_id}` : null);
  if (!agent && !expeditor && !agentDays) {
    return { agent: null, agentDays: null, expeditor: null, empty: true };
  }
  return { agent, agentDays, expeditor };
}

function stateToColumnValues(
  before: ReplayState,
  after: ReplayState,
  changedBy: string
): Record<string, string> {
  const values: Record<string, string> = {};
  if (changedBy) values.changedBy = changedBy;
  for (const { key } of CLIENT_AUDIT_FIELD_ROWS) {
    if (key === "changedBy") continue;
    const oldV = (before.scalars[key] ?? "").trim();
    const newV = (after.scalars[key] ?? "").trim();
    if (oldV !== newV && newV !== "") values[key] = newV;
  }
  return values;
}

function teamsForSnapshot(
  before: ReplayState,
  after: ReplayState
): { team1: ClientTeamSnapshot | null; team2: ClientTeamSnapshot | null } {
  const sig = (s: ReplayState, slot: number) => JSON.stringify(teamSnapshot(s.assignments.get(slot)));
  const t1Changed = sig(before, 1) !== sig(after, 1);
  const t2Changed = sig(before, 2) !== sig(after, 2);
  if (!t1Changed && !t2Changed) return { team1: null, team2: null };
  return {
    team1: teamSnapshot(after.assignments.get(1)),
    team2: teamSnapshot(after.assignments.get(2))
  };
}

function diffScalars(before: ReplayState, after: ReplayState): ClientFieldChange[] {
  const changes: ClientFieldChange[] = [];
  for (const { key, label } of CLIENT_AUDIT_FIELD_ROWS) {
    if (key === "changedBy") continue;
    const oldV = (before.scalars[key] ?? "").trim() || null;
    const newV = (after.scalars[key] ?? "").trim() || null;
    if (oldV === newV) continue;
    changes.push({ field: key, fieldLabel: label, oldValue: oldV, newValue: newV });
  }
  return changes;
}

function diffAssignments(before: ReplayState, after: ReplayState): ClientFieldChange[] {
  const changes: ClientFieldChange[] = [];
  const slots = new Set([...before.assignments.keys(), ...after.assignments.keys()]);
  for (const slot of slots) {
    const b = before.assignments.get(slot);
    const a = after.assignments.get(slot);
    const bAgent = formatAssignmentAgent(b ?? emptyAssignment(slot));
    const aAgent = formatAssignmentAgent(a ?? emptyAssignment(slot));
    if (bAgent !== aAgent) {
      changes.push({
        field: `team${slot}.agent`,
        fieldLabel: `Команда ${slot} · Агент`,
        oldValue: bAgent,
        newValue: aAgent
      });
    }
    const bDays = formatWeekdays(b?.visit_weekdays ?? []);
    const aDays = formatWeekdays(a?.visit_weekdays ?? []);
    if (bDays !== aDays) {
      changes.push({
        field: `team${slot}.days`,
        fieldLabel: `Команда ${slot} · Дни`,
        oldValue: bDays,
        newValue: aDays
      });
    }
    const bExp = b?.expeditor_name ?? (b?.expeditor_user_id ? `#${b.expeditor_user_id}` : null);
    const aExp = a?.expeditor_name ?? (a?.expeditor_user_id ? `#${a.expeditor_user_id}` : null);
    if (bExp !== aExp) {
      changes.push({
        field: `team${slot}.expeditor`,
        fieldLabel: `Команда ${slot} · Экспедитор`,
        oldValue: bExp,
        newValue: aExp
      });
    }
  }
  return changes;
}

function classifyChanges(changes: ClientFieldChange[], action: string): ClientHistoryFilter {
  if (action === "client.create") return "CREATE";
  const keys = new Set(changes.map((c) => c.field));
  const hasTeam = [...keys].some((k) => k.startsWith("team"));
  const hasAgent = [...keys].some((k) => k.includes(".agent"));
  const hasExp = [...keys].some((k) => k.includes(".expeditor"));
  const hasTerritory = keys.has("territory");
  const hasStatus = keys.has("active");
  if (hasExp) return "EXPEDITOR";
  if (hasAgent && !hasExp) return "AGENT";
  if (hasTeam) return "TEAM";
  if (hasTerritory) return "TERRITORY";
  if (hasStatus) return "STATUS";
  return "OTHER";
}

function actionTitle(action: string, filter: ClientHistoryFilter, changes: ClientFieldChange[]): string {
  if (action === "client.create") return "Клиент создан";
  if (action === "client.merge") return "Объединение клиентов";
  if (action === "client.balance_movement") return "Движение по балансу";
  if (action === "client.payment") return "Оплата";
  if (action === "client.sales_return") return "Возврат";
  if (filter === "TEAM") return "Команда обновлена";
  if (filter === "AGENT") return "Агент обновлён";
  if (filter === "EXPEDITOR") return "Экспедитор обновлён";
  if (filter === "TERRITORY") return "Территория изменена";
  if (filter === "STATUS") return "Статус изменён";
  if (changes.length === 1) return `Изменено: ${changes[0]!.fieldLabel}`;
  if (changes.length > 1) return `Изменено полей: ${changes.length}`;
  return "Изменение карточки";
}

function detailFallbackChanges(action: string, detail: Record<string, unknown>): ClientFieldChange[] {
  if (action === "client.balance_movement") {
    return [
      {
        field: "delta",
        fieldLabel: "Сумма",
        oldValue: null,
        newValue: strOrNull(detail.delta) ?? strOrNull(detail.amount)
      },
      {
        field: "note",
        fieldLabel: "Примечание",
        oldValue: null,
        newValue: strOrNull(detail.note)
      }
    ].filter((c) => c.newValue);
  }
  if (action === "client.payment") {
    return [
      {
        field: "amount",
        fieldLabel: "Сумма",
        oldValue: null,
        newValue: strOrNull(detail.amount)
      }
    ].filter((c) => c.newValue);
  }
  const raw = JSON.stringify(detail);
  if (raw === "{}") return [];
  return [{ field: "detail", fieldLabel: "Детали", oldValue: null, newValue: raw }];
}

export function formatClientAuditDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Шаблон: «11.05 16:01» в шапке таблицы */
export function formatClientAuditCreatedShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function snapshotFromLog(
  id: number,
  iso: string,
  before: ReplayState,
  after: ReplayState,
  changedBy: string
): ClientAuditSnapshotColumn {
  const teams = teamsForSnapshot(before, after);
  return {
    id,
    date: formatClientAuditDate(iso),
    values: stateToColumnValues(before, after, changedBy),
    team1: teams.team1,
    team2: teams.team2
  };
}

export function buildClientAuditHistoryViewModel(
  client: ClientRow & {
    created_by_user_label?: string | null;
    last_modified_by_user_label?: string | null;
    updated_at?: string;
  },
  logs: ClientAuditLogRow[]
): ClientAuditHistoryViewModel {
  const chronological = [...logs].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let state: ReplayState = {
    scalars: {},
    assignments: new Map(),
    territoryParts: { zone: "", city: "", region: "", district: "", neighborhood: "" }
  };
  const snapshots: ClientAuditSnapshotColumn[] = [];
  const history: ClientHistoryEntry[] = [];

  for (const log of chronological) {
    const before = cloneState(state);
    const detail = detailRecord(log.detail);
    const after = applyDetail(state, detail, client);
    state = after;

    const actor = log.user_login?.trim() || "—";
    const scalarChanges = diffScalars(before, after);
    const assignmentChanges = diffAssignments(before, after);
    let changes = [...scalarChanges, ...assignmentChanges];
    if (!changes.length && log.action !== "client.patch") {
      changes = detailFallbackChanges(log.action, detail);
    }
    const filter = classifyChanges(changes, log.action);

    history.push({
      id: log.id,
      date: log.created_at,
      user: actor,
      filter,
      action: log.action,
      title: actionTitle(log.action, filter, changes),
      changes
    });

    snapshots.push(snapshotFromLog(log.id, log.created_at, before, after, actor));
  }

  const createLog = chronological.find((l) => l.action === "client.create");
  const createdBy =
    client.created_by_user_label?.trim() ||
    createLog?.user_login?.trim() ||
    snapshots[0]?.values.changedBy ||
    "—";
  const createdAt = createLog?.created_at ?? client.created_at;

  if (snapshots.length === 0) {
    const current = clientToReplayState(client);
    const emptyBefore: ReplayState = {
      scalars: {},
      assignments: new Map(),
      territoryParts: { zone: "", city: "", region: "", district: "", neighborhood: "" }
    };
    snapshots.push(snapshotFromLog(0, client.created_at, emptyBefore, current, createdBy));
  }

  return {
    clientName: client.name,
    territory: territoryFromClient(client) || state.scalars.territory || "—",
    status: client.is_active ? "ACTIVE" : "INACTIVE",
    createdBy,
    createdAt,
    history: history.reverse(),
    snapshots
  };
}

export function filterClientHistory(
  history: ClientHistoryEntry[],
  filter: ClientHistoryFilter
): ClientHistoryEntry[] {
  if (filter === "ALL") return history;
  return history.filter((h) => h.filter === filter);
}

export function historyEntryBadgeLabel(entry: ClientHistoryEntry): string {
  return CLIENT_HISTORY_FILTER_META[entry.filter]?.label ?? entry.action;
}

export function historyEntryBadgeStyle(entry: ClientHistoryEntry): {
  color: string;
  bg: string;
  ring: string;
} {
  const m = CLIENT_HISTORY_FILTER_META[entry.filter] ?? CLIENT_HISTORY_FILTER_META.OTHER;
  return { color: m.color, bg: m.bg, ring: m.ring };
}

export function snapshotFieldLabel(key: string): string {
  return SNAPSHOT_LABEL_BY_KEY.get(key) ?? key;
}

export async function invalidateClientAuditQueries(
  qc: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> },
  tenantSlug: string,
  clientId: number
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: clientAuditAllQueryKey(tenantSlug, clientId) }),
    qc.invalidateQueries({ queryKey: clientAuditMetaQueryKey(tenantSlug, clientId) }),
    qc.invalidateQueries({ queryKey: ["client", tenantSlug, clientId, "audit-history"] }),
    qc.invalidateQueries({ queryKey: ["client-audit", tenantSlug, clientId] })
  ]);
}
