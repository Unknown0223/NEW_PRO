"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { Pencil, RefreshCw } from "lucide-react";

export type SalesChannelRow = {
  id: number;
  name: string;
  code: string | null;
  comment: string | null;
  sort_order: number;
  is_active: boolean;
};

type Props = { tenantSlug: string };

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

export function SalesChannelsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<SalesChannelRow | null>(null);

  const listQ = useQuery({
    queryKey: ["sales-channels-catalog", tenantSlug, tab],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("is_active", tab === "active" ? "true" : "false");
      const { data } = await api.get<{ data: SalesChannelRow[] }>(
        `/api/${tenantSlug}/sales-channels?${params.toString()}`
      );
      return data.data;
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.post(`/api/${tenantSlug}/sales-channels`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sales-channels-catalog", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["clients-references", tenantSlug] });
    }
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      await api.patch(`/api/${tenantSlug}/sales-channels/${id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sales-channels-catalog", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["settings", "profile", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["clients-references", tenantSlug] });
    }
  });

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = listQ.data ?? [];
    if (!q) return rows;
    return rows.filter((r) => [r.name, r.code ?? ""].join(" ").toLowerCase().includes(q));
  }, [listQ.data, search]);

  const total = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  useEffect(() => setPage(1), [tab, search, pageSize]);

  return (
    <>
      <div className="orders-hub-section orders-hub-section--table">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border bg-muted/25 px-3 py-0 sm:px-4">
              <div className="flex gap-1">
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === "active" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                  onClick={() => setTab("active")}
                >
                  Активный
                </button>
                <button
                  type="button"
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    tab === "inactive" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                  onClick={() => setTab("inactive")}
                >
                  Не активный
                </button>
              </div>
              <div className="flex flex-wrap gap-2 py-1">
                <Button type="button" size="sm" className="h-9" onClick={() => setAddOpen(true)}>
                  Добавить
                </Button>
              </div>
            </div>

            <div
              className="table-toolbar flex min-w-0 flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4"
              role="toolbar"
              aria-label="Таблица: поиск и экспорт"
            >
              <label className="grid shrink-0 gap-1 text-xs font-medium text-foreground/85">
                <span className="leading-none">На стр.</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number.parseInt(e.target.value, 10))}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="relative min-w-[12rem] max-w-xs flex-1">
                <Input
                  placeholder="Поиск"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full min-w-0 bg-background text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 text-xs"
                onClick={() => {
                  const headers = ["Название", "Код"];
                  const rows = filteredRows.map((r) => [r.name, r.code ?? ""]);
                  downloadXlsxSheet(
                    `sales_channels_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`,
                    "Каналы",
                    headers,
                    rows
                  );
                }}
              >
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                title="Обновить"
                onClick={() => void listQ.refetch()}
              >
                <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-xs">
                <colgroup>
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "42%" }} />
                  <col style={{ width: "4rem" }} />
                </colgroup>
          <thead className="app-table-thead">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Название</th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground">Код</th>
              <th className="px-2 py-2 text-right font-medium text-muted-foreground"> </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-t even:bg-muted/20">
                <td className="px-2 py-2 font-medium">{r.name}</td>
                <td className="px-2 py-2 font-mono">{r.code ?? "—"}</td>
                <td className="px-2 py-2 text-right">
                  <Button type="button" variant="ghost" size="icon-sm" title="Редактировать" onClick={() => setEditRow(r)}>
                    <Pencil className="size-3.5 text-amber-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/80 bg-muted/20 px-3 py-2 sm:px-4">
              <p className="text-xs text-muted-foreground">
                Показано{" "}
                {formatGroupedInteger(pageRows.length ? (safePage - 1) * pageSize + 1 : 0)} –{" "}
                {formatGroupedInteger((safePage - 1) * pageSize + pageRows.length)} /{" "}
                {formatGroupedInteger(total)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </Button>
                <span className="text-xs tabular-nums">
                  {formatGroupedInteger(safePage)} / {formatGroupedInteger(pageCount)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  ›
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChannelFormDialog
        mode="add"
        open={addOpen}
        onOpenChange={setAddOpen}
        saving={createMut.isPending}
        onSaveRequest={(body) => createMut.mutateAsync(body)}
      />
      <ChannelFormDialog
        mode="edit"
        open={Boolean(editRow)}
        row={editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        saving={patchMut.isPending}
        onSaveRequest={(body) => {
          if (!editRow) return Promise.reject(new Error("no row"));
          return patchMut.mutateAsync({ id: editRow.id, body });
        }}
      />
    </>
  );
}

function ChannelFormDialog({
  mode,
  open,
  row,
  onOpenChange,
  saving,
  onSaveRequest
}: {
  mode: "add" | "edit";
  open: boolean;
  row?: SalesChannelRow | null;
  onOpenChange: (o: boolean) => void;
  saving: boolean;
  onSaveRequest: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [comment, setComment] = useState("");
  const [sort_order, setSort] = useState("0");
  const [is_active, setActive] = useState(true);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setServerFieldErrs({});
    setMsg(null);
    if (mode === "add") {
      setName("");
      setCode("");
      setComment("");
      setSort("0");
      setActive(true);
    } else if (row) {
      setName(row.name);
      setCode(row.code ?? "");
      setComment(row.comment ?? "");
      setSort(String(row.sort_order));
      setActive(row.is_active);
    }
  }, [open, mode, row]);

  const submit = async () => {
    setServerFieldErrs({});
    setMsg(null);
    const so = Number.parseInt(sort_order, 10);
    const body = {
      name: name.trim(),
      code: code.trim() || null,
      comment: comment.trim() || null,
      sort_order: Number.isFinite(so) ? so : 0,
      is_active
    };
    try {
      await onSaveRequest(body);
      setServerFieldErrs({});
      setMsg(null);
      onOpenChange(false);
    } catch (e: unknown) {
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Ошибка сохранения."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Ошибка сохранения."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Добавить" : "Редактировать"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
          <label className="text-xs text-muted-foreground">
            Название
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название *" />
            {pickZodLeaf(serverFieldErrs, "name") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "name")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Код
            <Input className="mt-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} />
            <span className="text-[10px]">{code.length} / 20</span>
            {pickZodLeaf(serverFieldErrs, "code") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "code")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Комментарий
            <textarea
              className="mt-1 min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {pickZodLeaf(serverFieldErrs, "comment") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "comment")}</p>
            ) : null}
          </label>
          <label className="text-xs text-muted-foreground">
            Сортировка
            <Input className="mt-1" type="number" value={sort_order} onChange={(e) => setSort(e.target.value)} />
            {pickZodLeaf(serverFieldErrs, "sort_order") ? (
              <p className="mt-1 text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "sort_order")}</p>
            ) : null}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={is_active} onChange={(e) => setActive(e.target.checked)} />
            Активный
          </label>
          {pickZodLeaf(serverFieldErrs, "is_active") ? (
            <p className="text-xs text-destructive">{pickZodLeaf(serverFieldErrs, "is_active")}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" className="w-full" disabled={saving || !name.trim()} onClick={() => void submit()}>
            {mode === "add" ? "Добавить" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
