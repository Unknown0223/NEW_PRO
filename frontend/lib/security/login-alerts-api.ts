import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export type LoginAlertKind = "shared_device" | "concurrent_devices" | "new_device" | "shared_ip";
export type LoginAlertRisk = "high" | "medium" | "low";
export type LoginAlertStatus = "open" | "ok" | "confirmed";

export type LoginAlertUser = { id: number; name: string; login: string; role: string; is_active: boolean };

export type LoginAlertRow = {
  id: number;
  kind: LoginAlertKind;
  risk: LoginAlertRisk;
  status: LoginAlertStatus;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  match: Record<string, unknown>;
  last_device_name: string | null;
  last_ip: string | null;
  users: LoginAlertUser[];
  reviewed_at: string | null;
  reviewed_by_user_id: number | null;
  review_note: string | null;
};

export type LoginAlertEvent = {
  id: number;
  at: string;
  user: LoginAlertUser | null;
  platform: string;
  device_id: string | null;
  device_name: string | null;
  ip: string | null;
  user_agent: string | null;
};

export type LoginAlertSession = {
  id: number;
  user_id: number;
  device_name: string | null;
  device_id: string | null;
  ip: string | null;
  since: string;
};

export type LoginAlertDetail = LoginAlertRow & {
  reviewed_by: string | null;
  events: LoginAlertEvent[];
  active_sessions: LoginAlertSession[];
};

export type IpWhitelistRow = { id: number; cidr: string; label: string | null; created_at: string };

export type LoginAlertFilters = {
  status: LoginAlertStatus | "all";
  risk: LoginAlertRisk | "";
  kind: LoginAlertKind | "";
  from: string;
  to: string;
  q: string;
};

type ListResponse = {
  data: LoginAlertRow[];
  total: number;
  page: number;
  limit: number;
  open_counts: Partial<Record<LoginAlertRisk, number>>;
};

export const LOGIN_ALERT_KIND_LABEL: Record<LoginAlertKind, string> = {
  shared_device: "Одно устройство — разные аккаунты",
  concurrent_devices: "Аккаунт на нескольких телефонах",
  new_device: "Вход с нового устройства",
  shared_ip: "Один IP — разные аккаунты"
};

export const LOGIN_ALERT_KIND_HINT: Record<LoginAlertKind, string> = {
  shared_device: "С одного телефона/браузера входили разные сотрудники — возможно, логин и пароль переданы другому.",
  concurrent_devices: "Аккаунт одновременно активен на другом телефоне — им может пользоваться другой человек.",
  new_device: "Сотрудник вошёл с устройства, которого раньше не было.",
  shared_ip: "В течение нескольких минут с одного внешнего IP входили разные аккаунты. Офисные IP добавьте в белый список."
};

export const LOGIN_ALERT_RISK_LABEL: Record<LoginAlertRisk, string> = {
  high: "Высокий",
  medium: "Средний",
  low: "Низкий"
};

export const LOGIN_ALERT_STATUS_LABEL: Record<LoginAlertStatus, string> = {
  open: "Не проверено",
  ok: "Норма",
  confirmed: "Нарушение"
};

export const LOGIN_ALERT_ROLE_LABEL: Record<string, string> = {
  admin: "Админ",
  director: "Директор",
  agent: "Агент",
  expeditor: "Экспедитор",
  supervisor: "Супервайзер",
  operator: "Оператор",
  cashier: "Кассир",
  auditor: "Аудитор",
  warehouse: "Склад"
};

export function riskVariant(risk: LoginAlertRisk) {
  if (risk === "high") return "destructive" as const;
  if (risk === "medium") return "warning" as const;
  return "secondary" as const;
}

export function statusVariant(status: LoginAlertStatus) {
  if (status === "confirmed") return "destructive" as const;
  if (status === "ok") return "success" as const;
  return "info" as const;
}

export function roleLabel(role: string): string {
  return LOGIN_ALERT_ROLE_LABEL[role] ?? role;
}

export function fmtAlertDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ogohlantirish nimaga bog'langanini qisqa matn bilan. */
export function alertMatchText(row: Pick<LoginAlertRow, "kind" | "match" | "last_device_name" | "last_ip">): string {
  const m = row.match;
  if (row.kind === "shared_ip") return `IP ${String(m.ip ?? row.last_ip ?? "—")} · ${String(m.day ?? "")}`;
  const device = row.last_device_name || (typeof m.device_id === "string" ? m.device_id.slice(0, 12) : "");
  return [device, row.last_ip].filter(Boolean).join(" · ") || "—";
}

const ERROR_RU: Record<string, string> = {
  InvalidIp: "Укажите IP (213.230.1.5) или подсеть (213.230.1.0/24).",
  DuplicateIp: "Этот IP уже в белом списке.",
  UserNotInAlert: "Сотрудник не относится к этому предупреждению.",
  NotFound: "Запись не найдена."
};

export function loginAlertErrorMessage(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    const code = (e.response?.data as { error?: string } | undefined)?.error;
    if (code && ERROR_RU[code]) return ERROR_RU[code];
  }
  return getUserFacingError(e, fallback);
}

function useSlug() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  return { slug, ready: Boolean(slug) && hydrated };
}

function filterParams(f: LoginAlertFilters): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("status", f.status);
  if (f.risk) sp.set("risk", f.risk);
  if (f.kind) sp.set("kind", f.kind);
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.q.trim()) sp.set("q", f.q.trim());
  return sp;
}

export function useLoginAlerts(filters: LoginAlertFilters, page: number, limit: number) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["login-alerts", slug, filters, page, limit],
    enabled: ready,
    staleTime: STALE.list,
    queryFn: async () => {
      const sp = filterParams(filters);
      sp.set("page", String(page));
      sp.set("limit", String(limit));
      return (await api.get<ListResponse>(`/api/${slug}/security/login-alerts?${sp}`)).data;
    }
  });
}

export function useExportLoginAlerts() {
  const { slug } = useSlug();
  return async (filters: LoginAlertFilters) =>
    (await api.get<ListResponse>(`/api/${slug}/security/login-alerts/export?${filterParams(filters)}`)).data.data;
}

export function useLoginAlertDetail(id: number | null) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["login-alerts", slug, "detail", id],
    enabled: ready && id != null,
    staleTime: STALE.detail,
    queryFn: async () => (await api.get<{ data: LoginAlertDetail }>(`/api/${slug}/security/login-alerts/${id}`)).data.data
  });
}

export function useLoginAlertMutations() {
  const { slug } = useSlug();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["login-alerts", slug] });
  const review = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: LoginAlertStatus; note: string | null }) =>
      (await api.post<{ data: LoginAlertDetail }>(`/api/${slug}/security/login-alerts/${id}/review`, { status, note })).data.data,
    onSuccess: invalidate
  });
  const revoke = useMutation({
    mutationFn: async ({ id, userId }: { id: number; userId: number }) =>
      (await api.post<{ data: { revoked: number } }>(`/api/${slug}/security/login-alerts/${id}/revoke-sessions`, { user_id: userId }))
        .data.data,
    onSuccess: invalidate
  });
  return { review, revoke };
}

export function useIpWhitelist(enabled: boolean) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["login-alerts", slug, "ip-whitelist"],
    enabled: ready && enabled,
    staleTime: STALE.reference,
    queryFn: async () => (await api.get<{ data: IpWhitelistRow[] }>(`/api/${slug}/security/ip-whitelist`)).data.data
  });
}

export function useIpWhitelistMutations() {
  const { slug } = useSlug();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["login-alerts", slug, "ip-whitelist"] });
  const add = useMutation({
    mutationFn: async (body: { cidr: string; label: string | null }) =>
      (await api.post<{ data: IpWhitelistRow }>(`/api/${slug}/security/ip-whitelist`, body)).data.data,
    onSuccess: invalidate
  });
  const remove = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${slug}/security/ip-whitelist/${id}`);
    },
    onSuccess: invalidate
  });
  return { add, remove };
}
