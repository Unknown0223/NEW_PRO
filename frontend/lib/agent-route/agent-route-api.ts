import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type RouteStop = {
  sort_order: number;
  client_id: number;
  client_name: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
};

export type RoutePlanClient = {
  client_id: number;
  client_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  visit_weekdays: number[];
};

export type SavedRouteDay = {
  id: number;
  route_date: string;
  stops: unknown;
  notes: string | null;
  updated_at: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Server `stops` JSON → tartiblangan ro'yxat (eski kalitlar: lat/lon/name). */
export function parseSavedStops(raw: unknown): RouteStop[] {
  if (!Array.isArray(raw)) return [];
  const out: RouteStop[] = [];
  raw.forEach((s, i) => {
    if (!s || typeof s !== "object") return;
    const m = s as Record<string, unknown>;
    const id = Number(m.client_id);
    if (!Number.isFinite(id) || id <= 0) return;
    out.push({
      sort_order: Number(m.sort_order ?? i + 1) || i + 1,
      client_id: id,
      client_name: String(m.client_name ?? m.name ?? `#${id}`),
      address: typeof m.address === "string" ? m.address : null,
      latitude: num(m.latitude ?? m.lat),
      longitude: num(m.longitude ?? m.lon ?? m.lng),
      visited: m.visited === true
    });
  });
  return out.sort((a, b) => a.sort_order - b.sort_order);
}

export function planClientToStop(c: RoutePlanClient, i: number): RouteStop {
  return {
    sort_order: i + 1,
    client_id: c.client_id,
    client_name: c.client_name,
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
    visited: false
  };
}

function useSlug() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  return { slug, ready: Boolean(slug) && hydrated };
}

export function useRouteAgents() {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["agent-route", slug, "agents"],
    enabled: ready,
    staleTime: STALE.reference,
    queryFn: async () =>
      (await api.get<{ data: { id: number; name: string; code: string | null }[] }>(`/api/${slug}/agent-route-days/agents`))
        .data.data
  });
}

export function useRouteDay(agentId: number | null, date: string) {
  const { slug, ready } = useSlug();
  return useQuery({
    queryKey: ["agent-route", slug, "day", agentId, date],
    enabled: ready && agentId != null && /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 0,
    queryFn: async () => {
      const sp = new URLSearchParams({ agent_id: String(agentId), route_date: date });
      const [saved, plan] = await Promise.all([
        api.get<{ data: SavedRouteDay | null }>(`/api/${slug}/agent-route-days/one?${sp}`),
        api.get<{ data: { weekday: number; planned: RoutePlanClient[]; pool: RoutePlanClient[] } }>(
          `/api/${slug}/agent-route-days/suggest?${sp}`
        )
      ]);
      return { saved: saved.data.data, ...plan.data.data };
    }
  });
}

export function useSaveRouteDay() {
  const { slug } = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { agent_id: number; route_date: string; stops: RouteStop[] }) =>
      (await api.put<{ data: SavedRouteDay }>(`/api/${slug}/agent-route-days`, body)).data.data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["agent-route", slug, "day", v.agent_id, v.route_date] })
  });
}

export const WEEKDAY_RU = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
