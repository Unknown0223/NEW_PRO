"use client";

import { FilterSearchableSelect, type FilterSearchableOption } from "@/components/ui/filter-searchable-select";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TabKey = "new" | "ambiguous" | "unmatched" | "pending" | "done";
type ChannelKey = "manual" | "bank_verified";

type InboxRow = {
  id: number;
  status: string;
  source: string;
  channel?: ChannelKey;
  amount: number;
  currency: string;
  paid_at: string | null;
  payer_name: string | null;
  payer_inn: string | null;
  payer_bank_account: string | null;
  purpose: string | null;
  payment_id: number | null;
  assigned_client: { id: number; name: string; client_code: string | null } | null;
  match_field: string | null;
};

type InboxDetail = InboxRow & {
  raw_payload: unknown;
  match_candidates: unknown;
  candidate_clients: {
    id: number;
    name: string;
    client_code: string | null;
    inn: string | null;
    bank_account: string | null;
  }[];
  events: {
    id: number;
    event_type: string;
    comment: string | null;
    from_client_id: number | null;
    to_client_id: number | null;
    created_at: string;
  }[];
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "new", label: "Новые (матч)" },
  { key: "ambiguous", label: "Спорные" },
  { key: "unmatched", label: "Без клиента" },
  { key: "pending", label: "Ожидают подтверждения" },
  { key: "done", label: "Готово" }
];

function money(n: number) {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function rowChannel(r: { channel?: string; source?: string }): ChannelKey {
  if (r.channel === "manual" || r.channel === "bank_verified") return r.channel;
  return r.source === "manual" ? "manual" : "bank_verified";
}

function channelBadge(channel: ChannelKey) {
  return channel === "manual" ? "Вручную" : "Банк / 1С";
}

export function BankTransfersWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();
  const [channel, setChannel] = useState<ChannelKey>("bank_verified");
  const [tab, setTab] = useState<TabKey>("unmatched");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [comment, setComment] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [csvText, setCsvText] = useState("");
  const [xlsxBase64, setXlsxBase64] = useState<string | null>(null);
  const [xlsxFileName, setXlsxFileName] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualComment, setManualComment] = useState("");
  const [manualClientId, setManualClientId] = useState("");
  const [manualReport, setManualReport] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedClientSearch(clientSearch.trim()), 300);
    return () => window.clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    setSelectedClientId("");
    setClientSearch("");
    setDebouncedClientSearch("");
    setComment("");
    setActionError(null);
  }, [selectedId]);

  useEffect(() => {
    setSelectedId(null);
    setActionError(null);
    setManualReport(null);
    if (channel === "manual") setTab("pending");
    else setTab("unmatched");
  }, [channel]);

  const countsQ = useQuery({
    queryKey: ["bank-transfer-inbox-counts", tenantSlug, channel],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const params = new URLSearchParams({ channel });
      const { data } = await api.get<{ data: Record<TabKey, number> }>(
        `/api/${tenantSlug}/bank-transfer-inbox/counts?${params}`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["bank-transfer-inbox", tenantSlug, channel, tab, search],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const params = new URLSearchParams({ tab, page: "1", limit: "50", channel });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<{ data: InboxRow[]; meta: { total: number } }>(
        `/api/${tenantSlug}/bank-transfer-inbox?${params}`
      );
      return data;
    }
  });

  const detailQ = useQuery({
    queryKey: ["bank-transfer-inbox-detail", tenantSlug, selectedId],
    enabled: Boolean(tenantSlug) && selectedId != null,
    queryFn: async () => {
      const { data } = await api.get<{ data: InboxDetail }>(
        `/api/${tenantSlug}/bank-transfer-inbox/${selectedId}`
      );
      return data.data;
    }
  });

  const clientsQ = useQuery({
    queryKey: ["bank-transfer-inbox-client-search", tenantSlug, debouncedClientSearch],
    enabled: Boolean(tenantSlug),
    staleTime: 30_000,
    queryFn: async () => {
      const q = new URLSearchParams({
        page: "1",
        limit: "80",
        sort: "name",
        order: "asc",
        is_active: "true"
      });
      if (debouncedClientSearch) q.set("search", debouncedClientSearch);
      const { data } = await api.get<{
        data: Array<{
          id: number;
          name: string;
          client_code?: string | null;
          inn?: string | null;
        }>;
      }>(`/api/${tenantSlug}/clients?${q}`);
      return data.data ?? [];
    }
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["bank-transfer-inbox"] });
    await qc.invalidateQueries({ queryKey: ["bank-transfer-inbox-counts"] });
    await qc.invalidateQueries({ queryKey: ["bank-transfer-inbox-detail"] });
  };

  const runAction = useMutation({
    mutationFn: async (args: {
      path: string;
      body?: Record<string, unknown>;
    }) => {
      setActionError(null);
      const { data } = await api.post(`/api/${tenantSlug}/bank-transfer-inbox/${args.path}`, args.body ?? {});
      return data;
    },
    onSuccess: async () => {
      setComment("");
      setSelectedClientId("");
      await invalidate();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { message?: string; error?: string } } };
      setActionError(ax.response?.data?.message || ax.response?.data?.error || "Ошибка");
    }
  });

  const importMut = useMutation({
    mutationFn: async () => {
      setImportReport(null);
      const body = xlsxBase64
        ? { source: "excel" as const, xlsx_base64: xlsxBase64 }
        : { source: "csv" as const, csv: csvText };
      const { data } = await api.post(`/api/${tenantSlug}/bank-transfer-inbox/import`, body);
      return data.data as {
        created: number;
        skipped: number;
        row_errors?: { row: number; message: string }[];
      };
    },
    onSuccess: async (r) => {
      const errN = r.row_errors?.length ?? 0;
      setImportReport(
        `Создано: ${r.created}, пропущено (дубли): ${r.skipped}, ошибок строк: ${errN}`
      );
      setCsvText("");
      setXlsxBase64(null);
      setXlsxFileName(null);
      await invalidate();
    },
    onError: () => setImportReport("Ошибка импорта")
  });

  const manualMut = useMutation({
    mutationFn: async () => {
      setManualReport(null);
      setActionError(null);
      const amount = Number.parseFloat(manualAmount.replace(",", ".").trim());
      const clientId = Number.parseInt(manualClientId.trim(), 10);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Укажите сумму");
      if (!Number.isFinite(clientId) || clientId < 1) throw new Error("Выберите клиента");
      if (manualComment.trim().length < 1) throw new Error("Укажите комментарий");
      const paidAt = manualDate.trim()
        ? new Date(`${manualDate.trim()}T12:00:00`).toISOString()
        : null;
      const { data } = await api.post(`/api/${tenantSlug}/bank-transfer-inbox/manual`, {
        amount,
        client_id: clientId,
        comment: manualComment.trim(),
        paid_at: paidAt,
        create_payment: true
      });
      return data.data as InboxDetail;
    },
    onSuccess: async (detail) => {
      setManualReport(
        detail.payment_id
          ? `Создано вручную #${detail.id}, оплата #${detail.payment_id} ожидает подтверждения`
          : `Создано вручную #${detail.id}`
      );
      setManualAmount("");
      setManualComment("");
      setManualClientId("");
      setSelectedId(detail.id);
      setTab("pending");
      await invalidate();
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
      setManualReport(
        ax.response?.data?.message || ax.response?.data?.error || ax.message || "Ошибка"
      );
    }
  });

  const onImportFile = async (file: File | null) => {
    if (!file) return;
    setImportReport(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      setXlsxBase64(btoa(binary));
      setXlsxFileName(file.name);
      setCsvText("");
      return;
    }
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const text = await file.text();
      setCsvText(text);
      setXlsxBase64(null);
      setXlsxFileName(null);
      return;
    }
    setImportReport("Поддерживаются файлы .xlsx, .xls, .csv (или вставка текста ниже)");
  };

  const rows = listQ.data?.data ?? [];
  const detail = detailQ.data;
  const counts = countsQ.data;

  const clientIdNum = useMemo(() => {
    const n = Number.parseInt(selectedClientId.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedClientId]);

  const manualClientIdNum = useMemo(() => {
    const n = Number.parseInt(manualClientId.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [manualClientId]);

  const clientOptions: FilterSearchableOption[] = useMemo(() => {
    const byId = new Map<string, FilterSearchableOption>();
    const push = (c: {
      id: number;
      name: string;
      client_code?: string | null;
      inn?: string | null;
    }) => {
      const value = String(c.id);
      const code = c.client_code?.trim();
      const inn = c.inn?.trim();
      const label = [c.name?.trim() || `Клиент #${c.id}`, code ? `(${code})` : null, inn ? `ИНН ${inn}` : null]
        .filter(Boolean)
        .join(" ");
      byId.set(value, {
        value,
        label,
        searchText: [value, c.name, code, inn].filter(Boolean).join(" ")
      });
    };
    for (const c of clientsQ.data ?? []) push(c);
    for (const c of detail?.candidate_clients ?? []) push(c);
    if (detail?.assigned_client) push(detail.assigned_client);
    if (selectedClientId && !byId.has(selectedClientId)) {
      byId.set(selectedClientId, {
        value: selectedClientId,
        label: `Клиент #${selectedClientId}`
      });
    }
    if (manualClientId && !byId.has(manualClientId)) {
      byId.set(manualClientId, {
        value: manualClientId,
        label: `Клиент #${manualClientId}`
      });
    }
    return Array.from(byId.values());
  }, [
    clientsQ.data,
    detail?.assigned_client,
    detail?.candidate_clients,
    selectedClientId,
    manualClientId
  ]);

  return (
    <div className="min-h-0 space-y-4 px-3 py-3 pb-16 sm:px-4 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Перечисления (банк)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Два канала: вручную или из банка / 1С. Кассир подтверждает оплату в обоих случаях.
          </p>
        </div>
        <Link href="/payments" className="text-sm text-[#063b36] underline-offset-2 hover:underline">
          К оплатам клиентов
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {(
          [
            { key: "manual" as const, label: "Вручную" },
            { key: "bank_verified" as const, label: "Банк / 1С" }
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChannel(c.key)}
            className={cn(
              "rounded-md px-4 py-2 font-semibold transition",
              channel === c.key ? "bg-[#063b36] text-white shadow" : "text-slate-600 hover:bg-muted"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setSelectedId(null);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition",
              tab === t.key ? "bg-[#063b36] text-white shadow" : "text-slate-600 hover:bg-muted"
            )}
          >
            {t.label}
            {counts ? ` (${counts[t.key] ?? 0})` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Поиск: ИНН, счёт, назначение…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Сумма</th>
                  <th className="px-3 py-2">Канал</th>
                  <th className="px-3 py-2">Плательщик</th>
                  <th className="px-3 py-2">Клиент</th>
                  <th className="px-3 py-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {listQ.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                      Загрузка…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                      Нет записей
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const ch = rowChannel(r);
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "cursor-pointer border-b last:border-0 hover:bg-muted/30",
                          selectedId === r.id && "bg-muted/50"
                        )}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                        <td className="px-3 py-2 font-medium">
                          {money(r.amount)} {r.currency}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              ch === "manual"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-sky-50 text-sky-800"
                            )}
                          >
                            {channelBadge(ch)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="max-w-[180px] truncate">{r.payer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.payer_inn || r.payer_bank_account || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.assigned_client?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.status}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {channel === "manual" ? (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="text-sm font-medium">Новое перечисление вручную</div>
              <p className="text-xs text-muted-foreground">
                Сумма, клиент, дата и комментарий → pending-оплата для подтверждения кассиром.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs">
                  Сумма
                  <input
                    className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
                    inputMode="decimal"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="150000"
                  />
                </label>
                <label className="block text-xs">
                  Дата
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-xs">
                Клиент
                <div className="mt-1">
                  <FilterSearchableSelect
                    emptyLabel="Выберите клиента"
                    placeholderLabel="Поиск клиента…"
                    value={manualClientId}
                    onValueChange={setManualClientId}
                    options={clientOptions}
                    onSearchTextChange={setClientSearch}
                    includeEmptyOption={false}
                    searchPlaceholder="Имя, код, ИНН, ID…"
                    className="w-full"
                  />
                </div>
              </label>
              <label className="block text-xs">
                Комментарий
                <textarea
                  className="mt-1 h-20 w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  value={manualComment}
                  onChange={(e) => setManualComment(e.target.value)}
                  placeholder="Напр.: перечисление по договорённости"
                />
              </label>
              <button
                type="button"
                className="rounded-md bg-[#063b36] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={
                  !manualClientIdNum ||
                  !manualAmount.trim() ||
                  !manualComment.trim() ||
                  manualMut.isPending
                }
                onClick={() => manualMut.mutate()}
              >
                Создать вручную
              </button>
              {manualReport ? (
                <p className="text-sm text-muted-foreground">{manualReport}</p>
              ) : null}
            </div>
          ) : (
            <details className="rounded-lg border border-border bg-card p-3">
              <summary className="cursor-pointer text-sm font-medium">Импорт CSV / Excel (.xlsx)</summary>
              <p className="mt-2 text-xs text-muted-foreground">
                Файл .xlsx/.xls или CSV / вставка из Excel. Колонки: amount/сумма, inn/инн,
                bank_account/счёт, pinfl, client_code, payer_name, paid_at, purpose, external_id
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="mt-2 block w-full text-xs"
                onChange={(e) => {
                  void onImportFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              {xlsxFileName ? (
                <p className="mt-1 text-xs text-[#063b36]">Выбран Excel: {xlsxFileName}</p>
              ) : null}
              <textarea
                className="mt-2 h-32 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  if (e.target.value.trim()) {
                    setXlsxBase64(null);
                    setXlsxFileName(null);
                  }
                }}
                placeholder={"сумма;инн;плательщик\n150000;305123456;ООО Пример"}
                disabled={Boolean(xlsxBase64)}
              />
              <button
                type="button"
                className="mt-2 rounded-md bg-[#063b36] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                disabled={(!csvText.trim() && !xlsxBase64) || importMut.isPending}
                onClick={() => importMut.mutate()}
              >
                Загрузить
              </button>
              {importReport ? (
                <p className="mt-2 text-sm text-muted-foreground">{importReport}</p>
              ) : null}
            </details>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">Выберите строку слева</p>
          ) : detailQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка детали…</p>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">Не найдено</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-lg font-semibold">
                  {money(detail.amount)} {detail.currency}
                </div>
                <div className="text-muted-foreground">
                  #{detail.id} · {detail.status} · {channelBadge(rowChannel(detail))} ·{" "}
                  {detail.source}
                  {detail.match_field ? ` · матч: ${detail.match_field}` : ""}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Плательщик</dt>
                  <dd>{detail.payer_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ИНН / счёт</dt>
                  <dd>
                    {detail.payer_inn || "—"} / {detail.payer_bank_account || "—"}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Назначение</dt>
                  <dd>{detail.purpose || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Клиент</dt>
                  <dd>
                    {detail.assigned_client
                      ? `${detail.assigned_client.name} (#${detail.assigned_client.id})`
                      : "не назначен"}
                  </dd>
                </div>
              </dl>

              {detail.candidate_clients?.length > 0 ? (
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">Кандидаты</div>
                  <ul className="space-y-1 text-xs">
                    {detail.candidate_clients.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="text-left text-[#063b36] hover:underline"
                          onClick={() => setSelectedClientId(String(c.id))}
                        >
                          #{c.id} {c.name} · ИНН {c.inn || "—"} · {c.bank_account || "—"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2 border-t pt-3">
                <label className="block text-xs font-medium">Клиент</label>
                <FilterSearchableSelect
                  emptyLabel="Выберите клиента"
                  placeholderLabel="Поиск клиента…"
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  options={clientOptions}
                  onSearchTextChange={setClientSearch}
                  includeEmptyOption={false}
                  searchPlaceholder="Имя, код, ИНН, ID…"
                  className="w-full"
                />
                <label className="block text-xs font-medium">Комментарий (обязателен для assign/redirect)</label>
                <textarea
                  className="h-20 w-full rounded-md border border-border px-2 py-1.5"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-[#063b36] px-3 py-1.5 text-white disabled:opacity-50"
                    disabled={!clientIdNum || comment.trim().length < 3 || runAction.isPending}
                    onClick={() =>
                      runAction.mutate({
                        path: `${detail.id}/assign`,
                        body: {
                          client_id: clientIdNum,
                          comment: comment.trim(),
                          create_payment: true
                        }
                      })
                    }
                  >
                    Назначить + создать оплату
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
                    disabled={!clientIdNum || comment.trim().length < 3 || runAction.isPending}
                    onClick={() =>
                      runAction.mutate({
                        path: `${detail.id}/reassign`,
                        body: { client_id: clientIdNum, comment: comment.trim() }
                      })
                    }
                  >
                    Перенаправить
                  </button>
                  {detail.status === "matched" && !detail.payment_id ? (
                    <button
                      type="button"
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-white disabled:opacity-50"
                      disabled={runAction.isPending}
                      title="Клиент уже сопоставлен — создать pending-оплату"
                      onClick={() =>
                        runAction.mutate({ path: `${detail.id}/create-payment`, body: {} })
                      }
                    >
                      Создать оплату
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5"
                    disabled={!comment.trim() || runAction.isPending}
                    onClick={() =>
                      runAction.mutate({
                        path: `${detail.id}/comment`,
                        body: { comment: comment.trim() }
                      })
                    }
                  >
                    Комментарий
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-red-700"
                    onClick={() =>
                      runAction.mutate({
                        path: `${detail.id}/ignore`,
                        body: { comment: comment.trim() || null }
                      })
                    }
                  >
                    Игнорировать
                  </button>
                  {detail.payment_id ? (
                    <Link
                      href={`/payments/${detail.payment_id}`}
                      className="rounded-md border border-border px-3 py-1.5 text-[#063b36]"
                    >
                      К подтверждению #{detail.payment_id}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">История</div>
                <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                  {detail.events.map((e) => (
                    <li key={e.id} className="rounded border border-border/60 px-2 py-1">
                      <span className="font-medium">{e.event_type}</span>
                      {e.comment ? ` — ${e.comment}` : ""}
                      <div className="text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("ru-RU")}
                        {e.from_client_id || e.to_client_id
                          ? ` · ${e.from_client_id ?? "—"} → ${e.to_client_id ?? "—"}`
                          : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">Исходные данные</summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[10px]">
                  {JSON.stringify(detail.raw_payload, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
