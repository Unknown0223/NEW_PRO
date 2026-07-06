export type AuditAction =
  | "CREATE_CLIENT"
  | "UPDATE_TEAM"
  | "UPDATE_AGENT"
  | "UPDATE_EXPEDITOR"
  | "UPDATE_TERRITORY"
  | "UPDATE_STATUS";

export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface HistoryEntry {
  id: number;
  date: string; // ISO
  user: string;
  action: AuditAction;
  title: string;
  changes: FieldChange[];
}

export interface ClientHistoryData {
  clientId: number;
  clientName: string;
  territory: string;
  status: "ACTIVE" | "INACTIVE";
  createdBy: string;
  createdAt: string;
  history: HistoryEntry[];
}

export const ACTION_META: Record<
  AuditAction,
  { label: string; color: string; bg: string; ring: string; icon: string }
> = {
  CREATE_CLIENT: {
    label: "Yaratildi",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    icon: "plus",
  },
  UPDATE_TEAM: {
    label: "Komanda",
    color: "text-sky-700",
    bg: "bg-sky-50",
    ring: "ring-sky-200",
    icon: "users",
  },
  UPDATE_AGENT: {
    label: "Agent",
    color: "text-violet-700",
    bg: "bg-violet-50",
    ring: "ring-violet-200",
    icon: "user",
  },
  UPDATE_EXPEDITOR: {
    label: "Ekspeditor",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    icon: "truck",
  },
  UPDATE_TERRITORY: {
    label: "Hudud",
    color: "text-teal-700",
    bg: "bg-teal-50",
    ring: "ring-teal-200",
    icon: "map",
  },
  UPDATE_STATUS: {
    label: "Status",
    color: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    icon: "toggle",
  },
};

export const clientHistoryData: ClientHistoryData = {
  clientId: 123,
  clientName: "Client01",
  territory: "Chilonzor",
  status: "ACTIVE",
  createdBy: "Oper 01",
  createdAt: "2026-05-11T16:01:29",
  history: [
    {
      id: 1,
      date: "2026-05-11T16:01:29",
      user: "Oper 01",
      action: "CREATE_CLIENT",
      title: "Klient yaratildi",
      changes: [
        { field: "name", fieldLabel: "Nomi", oldValue: null, newValue: "Client01" },
        { field: "territory", fieldLabel: "Hudud", oldValue: null, newValue: "Chilonzor" },
        { field: "active", fieldLabel: "Aktiv", oldValue: null, newValue: "Ha" },
      ],
    },
    {
      id: 2,
      date: "2026-05-21T16:15:24",
      user: "Administrator",
      action: "UPDATE_TEAM",
      title: "Komanda 1 yangilandi",
      changes: [
        { field: "team1.agent", fieldLabel: "Komanda 1 · Agent", oldValue: null, newValue: "Agent 1" },
        { field: "team1.expeditor", fieldLabel: "Komanda 1 · Ekspeditor", oldValue: null, newValue: "Exp 1" },
      ],
    },
    {
      id: 3,
      date: "2026-06-05T13:55:34",
      user: "audit 002",
      action: "UPDATE_TEAM",
      title: "Komanda 2 biriktirildi",
      changes: [
        {
          field: "team2.agent",
          fieldLabel: "Komanda 2 · Agent",
          oldValue: null,
          newValue: "Vansel O'rikzor Vansel (Du)",
        },
      ],
    },
    {
      id: 4,
      date: "2026-06-05T13:55:46",
      user: "audit 002",
      action: "UPDATE_TEAM",
      title: "Komanda 2 tashrif kunlari o'zgartirildi",
      changes: [
        {
          field: "team2.days",
          fieldLabel: "Komanda 2 · Kunlar",
          oldValue: "Du",
          newValue: "Du, Se",
        },
      ],
    },
    {
      id: 5,
      date: "2026-06-05T13:55:57",
      user: "audit 002",
      action: "UPDATE_AGENT",
      title: "Komanda 1 agenti olib tashlandi",
      changes: [
        { field: "team1.agent", fieldLabel: "Komanda 1 · Agent", oldValue: "Agent 1", newValue: null },
        { field: "team1.expeditor", fieldLabel: "Komanda 1 · Ekspeditor", oldValue: "Exp 1", newValue: null },
      ],
    },
    {
      id: 6,
      date: "2026-06-08T12:19:09",
      user: "Oper 01",
      action: "UPDATE_AGENT",
      title: "Agent almashtirildi",
      changes: [
        {
          field: "team1.agent",
          fieldLabel: "Komanda 1 · Agent",
          oldValue: "(Bo'sh)",
          newValue: "Agent User (Ya, Du, Se, Cho, Pa, Ju, Sha)",
        },
      ],
    },
    {
      id: 7,
      date: "2026-06-10T16:58:44",
      user: "Oper 01",
      action: "UPDATE_EXPEDITOR",
      title: "Ekspeditor qo'shildi",
      changes: [
        {
          field: "team1.expeditor",
          fieldLabel: "Komanda 1 · Ekspeditor",
          oldValue: null,
          newValue: "Exp 1",
        },
        {
          field: "team2.expeditor",
          fieldLabel: "Komanda 2 · Ekspeditor",
          oldValue: null,
          newValue: "Exp 1",
        },
      ],
    },
  ],
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm} ${hh}:${mi}`;
}
