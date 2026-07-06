export interface TeamInfo {
  agent: string | null;
  agentDays: string | null;
  expeditor: string | null;
  empty?: boolean; // "(Пусто)"
}

export interface SnapshotColumn {
  id: number;
  date: string; // "11.05.2026 16:01:29"
  values: Record<string, string>;
  team1: TeamInfo | null;
  team2: TeamInfo | null;
}

export const FIELD_ROWS: { key: string; label: string }[] = [
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
  { key: "active", label: "Активный" },
];

export const AUDIT_META = {
  clientName: "Client01",
  createdBy: "Oper 01",
  createdAt: "11.05 16:01",
};

const ALL_DAYS = "Вс, Пн, Вт, Ср, Чт, Пт, Сб";

export const SNAPSHOT_COLUMNS: SnapshotColumn[] = [
  {
    id: 1,
    date: "11.05.2026 16:01:29",
    values: {
      name: "Client01",
      changedBy: "Oper 01",
      territory: "Chilonzor",
      active: "Да",
    },
    team1: null,
    team2: null,
  },
  {
    id: 2,
    date: "21.05.2026 16:15:24",
    values: {
      changedBy: "Administrator",
    },
    team1: { agent: "Agent 1", agentDays: null, expeditor: "Exp 1" },
    team2: { agent: null, agentDays: null, expeditor: null, empty: true },
  },
  {
    id: 3,
    date: "05.06.2026 13:55:34",
    values: {
      changedBy: "audit 002",
    },
    team1: { agent: "Agent 1", agentDays: null, expeditor: "Exp 1" },
    team2: { agent: "Vansel O'rikzor Vansel", agentDays: "Пн", expeditor: null },
  },
  {
    id: 4,
    date: "05.06.2026 13:55:46",
    values: {
      changedBy: "audit 002",
    },
    team1: { agent: "Agent 1", agentDays: null, expeditor: "Exp 1" },
    team2: { agent: "Vansel O'rikzor Vansel", agentDays: "Пн", expeditor: null },
  },
  {
    id: 5,
    date: "05.06.2026 13:55:57",
    values: {
      changedBy: "audit 002",
    },
    team1: { agent: null, agentDays: null, expeditor: null, empty: true },
    team2: { agent: "Vansel O'rikzor Vansel", agentDays: "Пн", expeditor: null },
  },
  {
    id: 6,
    date: "08.06.2026 12:19:09",
    values: {
      changedBy: "Oper 01",
    },
    team1: { agent: "Agent User", agentDays: ALL_DAYS, expeditor: "Exp 1" },
    team2: { agent: "Vansel O'rikzor Vansel", agentDays: "Пн", expeditor: null },
  },
  {
    id: 7,
    date: "10.06.2026 16:58:44",
    values: {
      changedBy: "Oper 01",
    },
    team1: { agent: "Agent User", agentDays: ALL_DAYS, expeditor: "Exp 1" },
    team2: { agent: "Vansel O'rikzor Vansel", agentDays: ALL_DAYS, expeditor: "Exp 1" },
  },
];
