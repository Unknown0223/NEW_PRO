"use client";

import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";

export type HistoryTimelineItem = {
  source: string;
  id: string;
  action: string;
  event_type?: string | null;
  actor_user_id: number | null;
  actor_login: string | null;
  detail: unknown;
  created_at: string;
};

export type EntityHistoryResponse = {
  entity_type: string;
  entity_id: string;
  items: HistoryTimelineItem[];
};

/** Manba (source) RU yorliqlari. */
export const HISTORY_SOURCE_LABEL: Record<string, string> = {
  audit: "Изменение",
  activity: "Действие",
  order_status: "Статус заказа",
  order_change: "Изменение заказа",
  client_audit: "Действие по клиенту",
  access_log: "Доступ"
};

/** Xatti-harakat (event_type) RU yorliqlari. */
export const HISTORY_EVENT_LABEL: Record<string, string> = {
  page_view: "Просмотр страницы",
  navigation: "Переход",
  view_intent: "Просмотр",
  form_open: "Открыл форму",
  form_abandon: "Закрыл без сохранения"
};

export function historyItemTitle(item: HistoryTimelineItem): string {
  if (item.event_type && HISTORY_EVENT_LABEL[item.event_type]) {
    return HISTORY_EVENT_LABEL[item.event_type];
  }
  return item.action;
}

/**
 * Birlashtirilgan per-entity tarixni `/api/:slug/history/:entityType/:entityId` dan oladi.
 * `enabled=false` bo'lsa so'rov yuborilmaydi (drawer ochilmaguncha).
 */
export function useEntityHistory(params: {
  tenantSlug: string | null | undefined;
  entityType: string;
  entityId: string | number | null | undefined;
  enabled?: boolean;
}) {
  const { tenantSlug, entityType, entityId, enabled = true } = params;
  const idStr = entityId == null ? "" : String(entityId);
  return useQuery({
    queryKey: ["entity-history", tenantSlug, entityType, idStr],
    enabled: Boolean(tenantSlug) && Boolean(idStr) && enabled,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<EntityHistoryResponse>(
        `/api/${tenantSlug}/history/${entityType}/${encodeURIComponent(idStr)}`
      );
      return data;
    }
  });
}
