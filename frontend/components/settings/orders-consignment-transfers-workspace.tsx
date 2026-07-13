"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerPopover, formatRuDateButton, localYmd } from "@/components/ui/date-picker-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { getUserFacingError } from "@/lib/error-utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type CommentFieldKey =
  | "order_number"
  | "client"
  | "agent"
  | "expeditor"
  | "payment_method"
  | "total_sum"
  | "delivered_at"
  | "days_overdue"
  | "unpaid"
  | "conditions";

const COMMENT_FIELD_OPTIONS: { key: CommentFieldKey; label: string }[] = [
  { key: "order_number", label: "№ заказа" },
  { key: "client", label: "Клиент" },
  { key: "agent", label: "Агент" },
  { key: "expeditor", label: "Экспедитор" },
  { key: "payment_method", label: "Способ оплаты" },
  { key: "total_sum", label: "Сумма заказа" },
  { key: "delivered_at", label: "Дата доставки" },
  { key: "days_overdue", label: "Дней после доставки" },
  { key: "unpaid", label: "Не оплачено" },
  { key: "conditions", label: "Свободный текст условий" }
];

type AutoSettings = {
  days_after_delivered: number;
  comment_fields: CommentFieldKey[];
};

type CandidateRow = {
  id: number;
  number: string;
  status: string;
  total_sum: string;
  unpaid: string;
  payment_method_ref: string | null;
  client_id: number;
  client_name: string;
  agent_id: number | null;
  agent_name: string | null;
  expeditor_id: number | null;
  expeditor_name: string | null;
  delivered_at: string;
  days_since_delivered: number;
  comment: string | null;
};

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

type Props = { tenantSlug: string };

export function OrdersConsignmentTransfersWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [daysDraft, setDaysDraft] = useState("3");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [commentFields, setCommentFields] = useState<Set<CommentFieldKey>>(
    () => new Set(COMMENT_FIELD_OPTIONS.map((o) => o.key))
  );
  const [conditions, setConditions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueOpen, setDueOpen] = useState(false);
  const dueAnchor = useRef<HTMLButtonElement>(null);
  const [modalErr, setModalErr] = useState<string | null>(null);

  const settingsQ = useQuery({
    queryKey: ["orders-consignment-auto-settings", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: AutoSettings }>(
        `/api/${tenantSlug}/orders/consignment-auto/settings`
      );
      return data.data;
    }
  });

  useEffect(() => {
    if (!settingsQ.data) return;
    setDaysDraft(String(settingsQ.data.days_after_delivered));
    setCommentFields(new Set(settingsQ.data.comment_fields));
  }, [settingsQ.data]);

  const daysForList =
    settingsQ.data?.days_after_delivered ?? (Number.parseInt(daysDraft, 10) || 3);

  const listQ = useQuery({
    queryKey: ["orders-consignment-auto-candidates", tenantSlug, daysForList, search, page],
    enabled: Boolean(tenantSlug) && settingsQ.isSuccess,
    staleTime: 15_000,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("page", String(page));
      p.set("page_size", "50");
      p.set("days_after_delivered", String(daysForList));
      if (search.trim()) p.set("search", search.trim());
      const { data } = await api.get<{
        data: {
          rows: CandidateRow[];
          total: number;
          page: number;
          page_size: number;
          days_after_delivered: number;
        };
      }>(`/api/${tenantSlug}/orders/consignment-auto/candidates?${p}`);
      return data.data;
    }
  });

  const rows = listQ.data?.rows ?? [];
  const total = listQ.data?.total ?? 0;
  const pageSize = listQ.data?.page_size ?? 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const allPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const saveDaysMut = useMutation({
    mutationFn: async (days: number) => {
      const { data } = await api.patch<{ data: AutoSettings }>(
        `/api/${tenantSlug}/orders/consignment-auto/settings`,
        { days_after_delivered: days }
      );
      return data.data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["orders-consignment-auto-settings", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["orders-consignment-auto-candidates", tenantSlug] });
      setPage(1);
      setSelected(new Set());
      setToast(`Давр сақланди: ${data.days_after_delivered} кун`);
    },
    onError: (e: unknown) => {
      setToast(getUserFacingError(e, "Даврни сақлаб бўлмади"));
    }
  });

  const convertMut = useMutation({
    mutationFn: async () => {
      setModalErr(null);
      const ids = Array.from(selected);
      if (ids.length === 0) throw new Error("Заказ танланмади");
      const fields = Array.from(commentFields);
      if (fields.length === 0) throw new Error("Камida битта майдонни белгиланг");
      if (fields.includes("conditions") && !conditions.trim()) {
        // optional free text even if checkbox on
      }
      const { data } = await api.post<{
        updated: number[];
        failed: { id: number; error: string }[];
      }>(`/api/${tenantSlug}/orders/consignment-auto/convert`, {
        order_ids: ids,
        comment_fields: fields,
        conditions_note: conditions.trim() || null,
        consignment_due_date: dueDate.trim() ? `${dueDate.trim()}T12:00:00.000Z` : null,
        save_comment_fields: true
      });
      return data;
    },
    onSuccess: (res) => {
      const ok = res.updated.length;
      const fail = res.failed.length;
      setToast(
        fail > 0
          ? `Консигнация: ${ok}. Хато: ${fail}`
          : `Консигнацияга ўтказилди: ${ok}`
      );
      setModalOpen(false);
      setSelected(new Set());
      setConditions("");
      setDueDate("");
      void qc.invalidateQueries({ queryKey: ["orders-consignment-auto-candidates", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["orders-consignment-transfers", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["orders", tenantSlug] });
    },
    onError: (e: unknown) => {
      setModalErr(e instanceof Error ? e.message : getUserFacingError(e, "Хато"));
    }
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      const all: CandidateRow[] = [];
      let p = 1;
      for (;;) {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("page_size", "200");
        params.set("days_after_delivered", String(daysForList));
        if (search.trim()) params.set("search", search.trim());
        const { data } = await api.get<{
          data: { rows: CandidateRow[]; total: number };
        }>(`/api/${tenantSlug}/orders/consignment-auto/candidates?${params}`);
        all.push(...data.data.rows);
        if (all.length >= data.data.total || data.data.rows.length === 0 || p > 40) break;
        p += 1;
      }
      return all;
    },
    onSuccess: async (exportRows) => {
      await downloadXlsxSheet(
        `consignment-candidates_${daysForList}d.xlsx`,
        "Кандидаты",
        [
          "№ заказа",
          "Клиент",
          "Агент",
          "Экспедитор",
          "Сумма",
          "Не оплачено",
          "Доставлен",
          "Дней",
          "Оплата",
          "Статус"
        ],
        exportRows.map((r) => [
          r.number,
          r.client_name,
          r.agent_name ?? "",
          r.expeditor_name ?? "",
          r.total_sum,
          r.unpaid,
          formatDt(r.delivered_at),
          r.days_since_delivered,
          r.payment_method_ref ?? "",
          r.status
        ]),
        { colWidths: [14, 24, 18, 18, 12, 12, 16, 8, 12, 12] }
      );
      setToast(`Excel: ${exportRows.length} қатор`);
    },
    onError: (e: unknown) => setToast(getUserFacingError(e, "Excel юклаб бўлмади"))
  });

  const previewComment = useMemo(() => {
    const sample = rows.find((r) => selected.has(r.id)) ?? rows[0];
    if (!sample) return "—";
    const parts: string[] = [];
    for (const f of commentFields) {
      switch (f) {
        case "order_number":
          parts.push(`Заказ: ${sample.number}`);
          break;
        case "client":
          parts.push(`Клиент: ${sample.client_name}`);
          break;
        case "agent":
          parts.push(`Агент: ${sample.agent_name ?? "—"}`);
          break;
        case "expeditor":
          parts.push(`Экспедитор: ${sample.expeditor_name ?? "—"}`);
          break;
        case "payment_method":
          parts.push(`Оплата: ${sample.payment_method_ref ?? "—"}`);
          break;
        case "total_sum":
          parts.push(`Сумма: ${formatNumberGrouped(sample.total_sum, { maxFractionDigits: 2 })}`);
          break;
        case "delivered_at":
          parts.push(`Доставлен: ${formatDt(sample.delivered_at)}`);
          break;
        case "days_overdue":
          parts.push(`Дней после доставки: ${sample.days_since_delivered}`);
          break;
        case "unpaid":
          parts.push(`Не оплачено: ${formatNumberGrouped(sample.unpaid, { maxFractionDigits: 2 })}`);
          break;
        case "conditions":
          if (conditions.trim()) parts.push(`Условия: ${conditions.trim()}`);
          break;
        default:
          break;
      }
    }
    return parts.join(" | ") || "—";
  }, [rows, selected, commentFields, conditions]);

  const onSaveDays = () => {
    const n = Number.parseInt(daysDraft, 10);
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setToast("Кунлар: 1…365");
      return;
    }
    void saveDaysMut.mutateAsync(n);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Заказы → консигнация</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Доставлен статусидаги, консигнациясиз ва тўлиқ тўланмаган заказлар — етказилганидан{" "}
            <b>N кун</b> ўтгач рўйхатга тушади. Танлаб консигнацияга ўтказишда комментарийга қайси
            маълумотлар кириши модалда белгиланади.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exportMut.isPending || total === 0}
            onClick={() => void exportMut.mutateAsync()}
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={selected.size === 0}
            onClick={() => {
              setModalErr(null);
              setModalOpen(true);
            }}
          >
            Консигнацияга ўтказиш ({selected.size})
          </Button>
        </div>
      </div>

      {toast ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm" role="status">
          {toast}{" "}
          <button type="button" className="text-primary underline" onClick={() => setToast(null)}>
            ёпиш
          </button>
        </p>
      ) : null}

      <Card className="border bg-card shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="grid gap-1.5">
            <Label className="text-xs">Давр (кун) — доставлендан кейин</Label>
            <div className="flex items-center gap-2">
              <Input
                className="h-9 w-24"
                inputMode="numeric"
                value={daysDraft}
                onChange={(e) => setDaysDraft(e.target.value.replace(/[^\d]/g, ""))}
              />
              <span className="text-sm text-muted-foreground">кун</span>
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={saveDaysMut.isPending}
                onClick={onSaveDays}
              >
                Сақлаш
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ҳозир: {daysForList} кун. Шу муддатдан ошган доставлен + тўланмаган заказлар рўйхатда.
            </p>
          </div>
          <div className="grid min-w-[14rem] flex-1 gap-1.5">
            <Label className="text-xs">Қидирув</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="№ заказ, клиент…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => void listQ.refetch()}
            disabled={listQ.isFetching}
          >
            <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            Янгилаш
          </Button>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-2 py-2 text-center">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allPageSelected}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (allPageSelected) rows.forEach((r) => next.delete(r.id));
                      else rows.forEach((r) => next.add(r.id));
                      return next;
                    });
                  }}
                  aria-label="Саҳифани танлаш"
                />
              </th>
              <th className="px-2 py-2">Заказ</th>
              <th className="px-2 py-2">Клиент</th>
              <th className="px-2 py-2">Агент / Эксп.</th>
              <th className="px-2 py-2 text-right">Сумма</th>
              <th className="px-2 py-2 text-right">Қарз</th>
              <th className="px-2 py-2">Доставлен</th>
              <th className="px-2 py-2 text-right">Кун</th>
              <th className="px-2 py-2">Оплата</th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading || settingsQ.isLoading ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  Юкланмоқда…
                </td>
              </tr>
            ) : null}
            {!listQ.isLoading && rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                  {daysForList} кундан ошган доставлен + тўланмаган консигнациясиз заказ йўқ
                </td>
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60 hover:bg-muted/10">
                <td className="px-2 py-2 text-center align-middle">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.has(r.id)}
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        return next;
                      });
                    }}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <Link href={`/orders/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.number}
                  </Link>
                  <div className="text-[11px] text-muted-foreground">{r.status}</div>
                </td>
                <td className="px-2 py-2 align-top">{r.client_name}</td>
                <td className="px-2 py-2 align-top text-xs">
                  {r.agent_name ?? "—"}
                  {r.expeditor_name ? (
                    <div className="text-muted-foreground">Эксп.: {r.expeditor_name}</div>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums">
                  {formatNumberGrouped(r.total_sum, { maxFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums font-medium text-amber-800 dark:text-amber-300">
                  {formatNumberGrouped(r.unpaid, { maxFractionDigits: 2 })}
                </td>
                <td className="px-2 py-2 align-top text-xs tabular-nums">{formatDt(r.delivered_at)}</td>
                <td className="px-2 py-2 text-right align-top tabular-nums font-semibold">
                  {r.days_since_delivered}
                </td>
                <td className="px-2 py-2 align-top text-xs">{r.payment_method_ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Орқа
          </Button>
          <span className="text-muted-foreground">
            {page} / {pageCount} · жами {formatNumberGrouped(total)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Олдин
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Жами: {formatNumberGrouped(total)}</p>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Консигнацияга ўтказиш</DialogTitle>
            <DialogDescription>
              Танланган: <b>{selected.size}</b>. Комментарийга қўшиладиган майдонларни белгиланг —
              ким/нима шартлари заказ комментарийсига ёзилади.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Комментарий майдонлари</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {COMMENT_FIELD_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={commentFields.has(opt.key)}
                      onChange={() => {
                        setCommentFields((prev) => {
                          const next = new Set(prev);
                          if (next.has(opt.key)) next.delete(opt.key);
                          else next.add(opt.key);
                          return next;
                        });
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            {commentFields.has("conditions") ? (
              <div className="grid gap-1.5">
                <Label>Қўшимча шартлар (матн)</Label>
                <textarea
                  rows={3}
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Масалан: нал тўланмаган; супервайзер келишуви…"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label>Тўлов муддати (ихтиёрий)</Label>
              <button
                ref={dueAnchor}
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 w-full justify-start gap-2"
                )}
                onClick={() => setDueOpen((o) => !o)}
              >
                <CalendarDays className="size-4 text-muted-foreground" />
                {dueDate ? formatRuDateButton(dueDate) : "Сана танланг"}
              </button>
              <DatePickerPopover
                open={dueOpen}
                onOpenChange={setDueOpen}
                anchorRef={dueAnchor}
                value={dueDate || localYmd(new Date())}
                onChange={setDueDate}
              />
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Комментарий намунаси
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground">{previewComment}</p>
            </div>
            {modalErr ? <p className="text-sm text-destructive">{modalErr}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Бекор
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={convertMut.isPending || selected.size === 0}
              onClick={() => void convertMut.mutateAsync()}
            >
              {convertMut.isPending ? "Сақланмоқда…" : "Ўтказиш"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
