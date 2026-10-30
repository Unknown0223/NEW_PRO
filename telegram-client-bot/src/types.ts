export type BotRole = string;

export type RefOption = {
  value: string;
  label: string;
  region?: string;
  region_label?: string;
  zone?: string;
};

export type ClientDraft = {
  name: string;
  legal_name: string;
  address: string;
  phone: string;
  responsible_person: string;
  landmark: string;
  inn: string;
  pinfl: string;
  sales_channel: string;
  sales_channel_label: string;
  category: string;
  category_label: string;
  client_type: string;
  client_type_label: string;
  client_format: string;
  client_format_label: string;
  city: string;
  city_label: string;
  region: string;
  region_label: string;
  zone: string;
  lat: number | null;
  lon: number | null;
  visit_weekdays: number[];
};

export type BotUser = {
  telegram_id: number;
  tenant_id: number;
  salec_user_id: number;
  role: BotRole;
  can_add_clients: boolean;
  can_download_intake: boolean;
  login: string;
  smart_code: string;
  agent_code: string | null;
  display_name: string | null;
  supervisor_user_id: number | null;
};

export type StoredClient = {
  id: number;
  agent_user_id: number;
  agent_telegram_id: number;
  agent_smart_code: string;
  agent_code: string | null;
  agent_name: string | null;
  payload: ClientDraft;
  created_at: string;
};

export type WizardField =
  | "name"
  | "legal_name"
  | "address"
  | "phone"
  | "responsible_person"
  | "landmark"
  | "inn"
  | "pinfl"
  | "sales_channel"
  | "category"
  | "client_type"
  | "client_format"
  | "region"
  | "city"
  | "location"
  | "visit_weekdays";

export type WizardKbKind = "wizard" | "location";

export type SessionData = {
  step: string;
  login: string;
  password: string;
  draft: Partial<ClientDraft>;
  editFromConfirm: boolean;
  selectPage: number;
  selectQ: string;
  weekdays: number[];
  editField: WizardField | "";
  wizardMsgId: number;
  wizardChatId: number;
  wizardKbKind: WizardKbKind | "";
  wizardError: string;
};

export const EMPTY_SESSION = (): SessionData => ({
  step: "idle",
  login: "",
  password: "",
  draft: {},
  editFromConfirm: false,
  selectPage: 0,
  selectQ: "",
  weekdays: [],
  editField: "",
  wizardMsgId: 0,
  wizardChatId: 0,
  wizardKbKind: "",
  wizardError: ""
});

export const WIZARD_ORDER: WizardField[] = [
  "name",
  "legal_name",
  "address",
  "phone",
  "responsible_person",
  "landmark",
  "inn",
  "pinfl",
  "sales_channel",
  "category",
  "client_type",
  "client_format",
  "region",
  "city",
  "location",
  "visit_weekdays"
];

export const OPTIONAL_FIELDS = new Set<WizardField>([
  "legal_name",
  "responsible_person",
  "landmark",
  "inn",
  "pinfl"
]);

export const SELECT_FIELDS = new Set<WizardField>([
  "sales_channel",
  "category",
  "client_type",
  "client_format",
  "region",
  "city"
]);

export function botCanAdd(user: Pick<BotUser, "can_add_clients" | "role">): boolean {
  if (typeof user.can_add_clients === "boolean") return user.can_add_clients;
  return user.role === "agent";
}

export function botCanDownload(user: Pick<BotUser, "can_download_intake" | "role">): boolean {
  if (typeof user.can_download_intake === "boolean") return user.can_download_intake;
  return user.role !== "agent";
}
