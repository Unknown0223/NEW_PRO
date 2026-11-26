"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  appendParams,
  formatCell
} from "@/components/reports/flat-report/flat-report-helpers";
import type { DraftState } from "@/components/reports/flat-report/flat-report-helpers";

export type VisitsDetailType =
  | "okb"
  | "only_order"
  | "rejected"
  | "only_photo"
  | "not_visited"
  | "visited";

export type VisitsDetailOpen = {
  type: VisitsDetailType;
  agentId: number;
  agentName: string;
  applied: Record<string, string | number | string[]>;
};

const TYPE_LABEL: Record<VisitsDetailType, string> = {
  okb: "ОКБ",
  only_order: "АКБ",
  rejected: "Отказы",
  only_photo: "Фотоотчёты",
  not_visited: "Непосещенные",
  visited: "Посещённые"
};

type DetailRow = {
  client_id: number;
  client_name: string;
  visited_at: string | null;
  order_sum: string;
  refusal_label: string;
  photo_count: number;
  inventory_label: string;
  last_purchase_sum: string;
  last_purchase_at: string | null;
};

type Props = {
  open: VisitsDetailOpen | null;
  onOpenChange: (next: VisitsDetailOpen | null) => void;
};

export function VisitsDetailModal({ open, onOpenChange }: Props) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const enabled = Boolean(open && tenantSlug);

  const detailQ = useQuery({
    queryKey: ["visits-detail", tenantSlug, open?.agentId, open?.type, open?.applied],
    enabled,
    staleTime: STALE.report,
    queryFn: async () => {
      if (!open || !tenantSlug) throw new Error("missing");
      const p = new URLSearchParams();
      p.set("agent_id", String(open.agentId));
      p.set("type", open.type);
      const filterState: DraftState = {
        from: open.applied.from ?? "",
        to: open.applied.to ?? "",
        statuses: Array.isArray(open.applied.statuses) ? open.applied.statuses : [],
        visit_kinds: Array.isArray(open.applied.visit_kinds) ? open.applied.visit_kinds : [],
        client_categories: Array.isArray(open.applied.client_categories)
          ? open.applied.client_categories
          : [],
        territory_1_list: Array.isArray(open.applied.territory_1_list)
          ? open.applied.territory_1_list
          : [],
        territory_2_list: Array.isArray(open.applied.territory_2_list)
          ? open.applied.territory_2_list
          : [],
        territory_3_list: Array.isArray(open.applied.territory_3_list)
          ? open.applied.territory_3_list
          : [],
        supervisor_ids: Array.isArray(open.applied.supervisor_ids)
          ? open.applied.supervisor_ids
          : []
      };
      appendParams(p, filterState);
      const { data } = await api.get<{
        data: { rows: DetailRow[]; total: number; truncated: boolean };
      }>(`/api/${tenantSlug}/reports/visits/detail?${p.toString()}`);
      return data.data;
    }
  });

  const title = open
    ? `${TYPE_LABEL[open.type]}: ${open.agentName || "—"}`
    : "";

  return (
    <Dialog open={Boolean(open)} onOpenChange={(v) => !v && onOpenChange(null)}>
      <DialogContent
        className="flex max-h-[90vh] w-[min(1120px,calc(100vw-2rem))] max-w-[min(1120px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden rounded-sm border bg-white p-4 shadow-xl sm:max-w-[min(1120px,calc(100vw-2rem))]"
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto">
          {detailQ.isLoading ? (
            <p className="px-1 py-6 text-sm text-muted-foreground">Загрузка…</p>
          ) : detailQ.isError ? (
            <p className="px-1 py-6 text-sm text-destructive">Не удалось загрузить детали</p>
          ) : (detailQ.data?.rows.length ?? 0) === 0 ? (
            <p className="px-1 py-6 text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <>
              {detailQ.data?.truncated ? (
                <p className="mb-2 text-xs text-amber-800">
                  Показаны первые {detailQ.data.rows.length} из {detailQ.data.total}
                </p>
              ) : null}
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="app-table-thead sticky top-0 z-[1]">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Клиент</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Время</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Сумма заказа</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Отказ</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Фото</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Инвентарь</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right">Последний закуп</th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Дата последнего закупа</th>
                  </tr>
                </thead>
                <tbody>
                  {detailQ.data?.rows.map((r) => (
                    <tr key={r.client_id} className="border-t border-border/60">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{r.client_name}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.visited_at
                          ? new Date(r.visited_at).toLocaleString("ru-RU")
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCell(r.order_sum, "money")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{r.refusal_label || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{r.photo_count}</td>
                      <td className="whitespace-nowrap px-3 py-2" title={r.inventory_label}>
                        {r.inventory_label || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {formatCell(r.last_purchase_sum, "money")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.last_purchase_at
                          ? new Date(r.last_purchase_at).toLocaleDateString("ru-RU")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
