"use client";

import { ClientsListPagination } from "@/components/clients/clients-table-toolbar";
import { ClientsListSearchInput } from "@/components/clients/clients-list-search-input";
import { PageShell } from "@/components/dashboard/page-shell";
import { formatPaymentDt, Td, Th } from "@/components/payments/client-payments/template-ui";
import {
  PaymentEditGrantsFiltersPanel,
  type EditGrantsFilterDraft
} from "@/components/payments/payment-edit-grants-filters-panel";
import { RestorePaymentModal } from "@/components/payments/client-payments/restore-payment-modal";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import { staffPickerDisplayName } from "@/lib/person-display";
import { activeRefSelectOptions, refEntryLabelByStored } from "@/lib/profile-ref-entries";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, RotateCcw, RotateCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type GrantRow = {
  id: number;
  payment_id: number;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  status: string;
  access_user_id: number;
  access_user_name: string;
  cancel_reason_ref: string | null;
  created_by_user_id: number | null;
  created_by_name: string | null;
  comment: string | null;
  can_restore_payment: boolean;
};

type EditGrantsListResponse = {
  data: GrantRow[];
  total: number;
  page: number;
  limit: number;
};

type StaffPick = { id: number; fio: string; code?: string | null };

const TABLE_VISIBLE_ROWS = 15;
const TABLE_BODY_MAX_PX = 36 + TABLE_VISIBLE_ROWS * 36;

function monthBoundsUtcIso(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(last)}`
  };
}

const defaultDraft = (): EditGrantsFilterDraft & { search: string } => {
  const { from, to } = monthBoundsUtcIso();
  return {
    date_from: from,
    date_to: to,
    status: "",
    access_user_id: "",
    cancel_reason_ref: "",
    search: ""
  };
};

function grantStatusLabel(status: string): string {
  if (status === "completed") return "Завершен";
  if (status === "deleted") return "Удален";
  if (status === "restored") return "Восстановлен";
  return "—";
}

function GrantStatusBadge({ status }: { status: string }) {
  if (status === "restored") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
        Восстановлен
      </span>
    );
  }
  if (status !== "completed" && status !== "deleted") return null;
  const completed = status === "completed";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        completed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
      )}
    >
      {completed ? "Завершен" : "Удален"}
    </span>
  );
}

function downloadEditGrantsExcel(rows: GrantRow[], reasonLabel: (ref: string | null) => string) {
  downloadXlsxSheet(
    `edit-grants-${new Date().toISOString().slice(0, 10)}.xlsx`,
    "Разрешённые платежи",
    [
      "ID оплаты",
      "Дата создания",
      "Дата окончания срока",
      "Дата завершения",
      "Статус",
      "Пользователь с доступом",
      "Причина отмены",
      "Создано",
      "Комментарий"
    ],
    rows.map((r) => [
      r.payment_id,
      r.created_at,
      r.expires_at,
      r.completed_at ?? "",
      grantStatusLabel(r.status),
      r.access_user_name,
      reasonLabel(r.cancel_reason_ref),
      r.created_by_name ?? "",
      r.comment ?? ""
    ])
  );
}

export function PaymentEditGrantsWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();
  const qc = useQueryClient();
  const canRestorePayments = effectiveRole === "admin";

  const [draft, setDraft] = useState(defaultDraft);
  const [applied, setApplied] = useState(defaultDraft);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePaymentId, setRestorePaymentId] = useState<number | undefined>();

  const openRestore = useCallback((paymentId: number) => {
    setRestorePaymentId(paymentId);
    setRestoreOpen(true);
  }, []);

  const onRestoreConfirmed = useCallback(() => {
    setApplied((a) => ({ ...a, status: "restored" }));
    setDraft((d) => ({ ...d, status: "restored" }));
    void qc.invalidateQueries({ queryKey: ["payment-edit-grants", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["payments", tenantSlug] });
    void qc.invalidateQueries({ queryKey: ["client-balance-ledger", tenantSlug] });
  }, [qc, tenantSlug]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("limit", String(pageSize));
    if (applied.date_from) p.set("date_from", applied.date_from);
    if (applied.date_to) p.set("date_to", applied.date_to);
    if (applied.status) p.set("status", applied.status);
    if (applied.access_user_id) p.set("access_user_id", applied.access_user_id);
    if (applied.cancel_reason_ref) p.set("cancel_reason_ref", applied.cancel_reason_ref);
    if (applied.search.trim()) p.set("search", applied.search.trim());
    return p.toString();
  }, [applied, page, pageSize]);

  const listQ = useQuery({
    queryKey: ["payment-edit-grants", tenantSlug, queryString],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<EditGrantsListResponse>(
        `/api/${tenantSlug}/payments/edit-grants?${queryString}`
      );
      return data;
    }
  });

  const expeditorsQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "edit-grants-filters"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffPick[] }>(`/api/${tenantSlug}/expeditors?is_active=true`);
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "edit-grants-reasons"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { cancel_payment_reason_entries?: unknown };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.cancel_payment_reason_entries;
    }
  });

  const reasonOptions = useMemo(() => activeRefSelectOptions(profileQ.data), [profileQ.data]);

  const reasonLabel = useCallback(
    (ref: string | null) => {
      if (!ref?.trim()) return "—";
      return refEntryLabelByStored(profileQ.data, ref) ?? ref;
    },
    [profileQ.data]
  );

  const statusOptions = useMemo(
    () => [
      { value: "completed", label: "Завершен" },
      { value: "deleted", label: "Удален" },
      { value: "restored", label: "Восстановлен" }
    ],
    []
  );

  const expeditorOptions = useMemo(
    () =>
      (expeditorsQ.data ?? []).map((e) => ({
        value: String(e.id),
        label: staffPickerDisplayName(e)
      })),
    [expeditorsQ.data]
  );

  const applyFilters = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  const resetDraftToApplied = useCallback(() => setDraft({ ...applied }), [applied]);

  if (!hydrated) {
    return <p className="p-6 text-sm text-slate-500">Загрузка сессии…</p>;
  }
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-red-600">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  const rows = listQ.data?.data ?? [];
  const totalPages = listQ.data ? Math.max(1, Math.ceil(listQ.data.total / listQ.data.limit)) : 1;

  return (
    <PageShell className="flex min-h-0 flex-1 flex-col gap-4 p-0 pb-0">
      <div className="shrink-0 px-4 sm:px-6">
        <PaymentEditGrantsFiltersPanel
          draft={draft}
          statusOptions={statusOptions}
          expeditorOptions={expeditorOptions}
          reasonOptions={reasonOptions}
          onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onApply={applyFilters}
          onReset={resetDraftToApplied}
          onDateRangeApplied={(dateFrom, dateTo) => {
            const patch = { date_from: dateFrom, date_to: dateTo };
            setDraft((d) => ({ ...d, ...patch }));
            setApplied((a) => ({ ...a, ...patch }));
            setPage(1);
          }}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="space-y-3">
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
            role="toolbar"
          >
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
              title="Настройки"
            >
              <SlidersHorizontal className="h-4 w-4 text-gray-600" />
            </button>
            <select
              className="h-8 cursor-pointer rounded-md border-none bg-transparent pr-6 text-xs font-semibold text-gray-800 focus:ring-0"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Строк на странице"
            >
              {[15, 10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <div className="mx-1 hidden h-5 w-px shrink-0 bg-muted md:block" />
            <ClientsListSearchInput
              value={draft.search}
              onChange={(v) => {
                setDraft((d) => ({ ...d, search: v }));
                setApplied((a) => ({ ...a, search: v }));
                setPage(1);
              }}
              className="min-w-[9rem] flex-1"
            />
            <button
              type="button"
              disabled={!rows.length}
              onClick={() => downloadEditGrantsExcel(rows, reasonLabel)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => void listQ.refetch()}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
              title="Обновить"
            >
              <RotateCw className={cn("h-4 w-4 text-gray-600", listQ.isFetching && "animate-spin")} />
            </button>
          </div>

          <div className="text-right">
            <Link
              href="/payments"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              ← Оплаты клиентов
            </Link>
          </div>
        </div>

        {listQ.isLoading ? <p className="mt-3 text-sm text-gray-600">Загрузка…</p> : null}
        {listQ.isError ? (
          <p className="mt-3 text-sm text-red-600">{getUserFacingError(listQ.error, "Ошибка загрузки.")}</p>
        ) : null}

        <div className="mt-3 shrink-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div
            className="scrollbar-none overflow-auto overscroll-contain"
            style={{ maxHeight: rows.length > 0 ? TABLE_BODY_MAX_PX : undefined }}
          >
            <table className="min-w-full divide-y divide-border text-[12px]">
              <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <Th>ID оплаты</Th>
                  <Th>Дата создания</Th>
                  <Th>Дата окончания срока</Th>
                  <Th>Дата завершения</Th>
                  <Th>Статус</Th>
                  <Th>Имя пользователя с доступом</Th>
                  <Th>Причины отмены оплаты</Th>
                  <Th>Создано</Th>
                  <Th>Комментарий</Th>
                  {canRestorePayments ? (
                    <Th>
                      <span className="sr-only">Действия</span>
                    </Th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {rows.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/80">
                    <Td>
                      <Link
                        href={`/payments/${c.payment_id}`}
                        className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                      >
                        {c.payment_id}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Td>
                    <Td>{formatPaymentDt(c.created_at)}</Td>
                    <Td>{formatPaymentDt(c.expires_at)}</Td>
                    <Td>{c.completed_at ? formatPaymentDt(c.completed_at) : "—"}</Td>
                    <Td>
                      {c.status === "completed" ||
                      c.status === "deleted" ||
                      c.status === "restored" ? (
                        <GrantStatusBadge status={c.status} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="font-medium text-emerald-700">{c.access_user_name}</span>
                    </Td>
                    <Td className="max-w-[200px] truncate" title={reasonLabel(c.cancel_reason_ref)}>
                      {reasonLabel(c.cancel_reason_ref)}
                    </Td>
                    <Td>
                      {c.created_by_name ? (
                        <span className="font-medium text-emerald-700">{c.created_by_name}</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="max-w-[180px] whitespace-pre-line text-gray-500">{c.comment ?? ""}</Td>
                    {canRestorePayments ? (
                      <Td className="!px-1">
                        {c.can_restore_payment ? (
                          <button
                            type="button"
                            onClick={() => openRestore(c.payment_id)}
                            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                            title="Восстановить платёж"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {!listQ.isLoading && rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">Нет данных</div>
            ) : null}
          </div>

          {listQ.data ? (
            <ClientsListPagination
              page={page}
              totalPages={totalPages}
              total={listQ.data.total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>

      {canRestorePayments ? (
        <RestorePaymentModal
          open={restoreOpen}
          onClose={() => setRestoreOpen(false)}
          tenantSlug={tenantSlug}
          paymentId={restorePaymentId}
          onConfirmed={onRestoreConfirmed}
        />
      ) : null}
    </PageShell>
  );
}
