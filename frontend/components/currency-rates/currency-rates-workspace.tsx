"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { DatePickerPopover, formatRuDateButton, localYmd } from "@/components/ui/date-picker-popover";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError, type AxiosError } from "axios";
import { CalendarDays, Download, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RateRow = {
  id: number;
  rate_date: string;
  base_currency: string;
  quote_currency: string;
  rate: string;
  source: string | null;
  note: string | null;
  created_at: string;
};

type ListResponse = { page: number; limit: number; total: number; data: RateRow[] };

type CurrencyEntry = { id: string; name: string; code: string; active?: boolean };

function monthRange(): { from: string; to: string } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

function fmtRate(s: string): string {
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return formatNumberGrouped(n, { minFractionDigits: 2, maxFractionDigits: 8 });
}

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

function listLoadErrorMessage(e: unknown): string {
  const ax = e as AxiosError<{ error?: string; message?: string }> | undefined;
  const st = ax?.response?.status;
  const d = ax?.response?.data;
  if (st === 503 && d?.error === "DatabaseSchemaMismatch") {
    return (
      d.message ??
      "В базе нет таблицы курсов. В корне проекта выполните: npm run db:deploy, затем перезапустите API."
    );
  }
  return getUserFacingError(e, "Не удалось загрузить курсы.");
}

const SAVE_ERR_RU: Record<string, string> = {
  SAME_CURRENCY: "База и котировка должны быть разными валютами.",
  DUPLICATE_RATE: "На эту дату такая пара уже внесена.",
  BAD_RATE: "Укажите положительный курс.",
  BAD_RATE_DATE: "Некорректная дата курса.",
  BAD_CURRENCY_CODE: "Код валюты не из справочника.",
  CURRENCY_NOT_IN_DIRECTORY: "Добавьте валюты в Настройки → Валюты или включите их.",
  BAD_BODY: "Проверьте поля формы."
};

function saveErrorMessage(e: unknown): string {
  if (!isAxiosError(e)) return getUserFacingError(e, "Ошибка сохранения");
  const data = e.response?.data as { message?: string; error?: string; domainCode?: string } | undefined;
  const flat = getZodFlattenFromApiErrorBody(data);
  if (flat) {
    const per = firstMessagePerField(flat);
    const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
    const hint = firstValidationUserHint(flat);
    const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
    return line ? withApiSupportLine(line, e) : getUserFacingError(e, "Ошибка сохранения");
  }
  const domain = typeof data?.domainCode === "string" ? data.domainCode : undefined;
  if (domain && SAVE_ERR_RU[domain]) return withApiSupportLine(SAVE_ERR_RU[domain], e);
  const code = data?.error;
  if (typeof code === "string" && SAVE_ERR_RU[code]) return withApiSupportLine(SAVE_ERR_RU[code], e);
  return getUserFacingError(e, "Ошибка сохранения");
}

function saveErrorFields(e: unknown): Record<string, string> {
  if (!isAxiosError(e)) return {};
  const flat = getZodFlattenFromApiErrorBody(e.response?.data);
  return flat ? firstMessagePerField(flat) : {};
}

export function CurrencyRatesWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const { has } = usePermissions();
  const canWrite =
    has("cash.kurs_valyuty.create") || has("cash.kurs_valyuty.update");
  const qc = useQueryClient();
  const init = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<RateRow | null>(null);
  const [formDate, setFormDate] = useState(init.from);
  const [formBase, setFormBase] = useState("USD");
  const [formQuote, setFormQuote] = useState("UZS");
  const [formRate, setFormRate] = useState("");
  const [formSource, setFormSource] = useState("manual");
  const [formNote, setFormNote] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formFieldErrs, setFormFieldErrs] = useState<Record<string, string>>({});
  const [formDatePickerOpen, setFormDatePickerOpen] = useState(false);
  const formDateRef = useRef<HTMLButtonElement>(null);

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "currency-rates"],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{ references?: { currency_entries?: CurrencyEntry[] } }>(
        `/api/${tenantSlug}/settings/profile`
      );
      return data;
    }
  });

  const currencyCodes = useMemo(() => {
    const list = profileQ.data?.references?.currency_entries ?? [];
    const active = list.filter((c) => c.active !== false);
    const codes = (active.length > 0 ? active : list).map((c) => c.code.trim().toUpperCase()).filter(Boolean);
    return Array.from(new Set(codes)).sort();
  }, [profileQ.data]);

  const pickerCodes = useMemo(
    () => (currencyCodes.length > 0 ? currencyCodes : ["UZS"]),
    [currencyCodes]
  );

  const quoteOptions = useMemo(() => pickerCodes.filter((c) => c !== formBase), [pickerCodes, formBase]);

  const quoteSelectOptions = useMemo(() => {
    const opts = quoteOptions;
    if (dialogOpen && editRow && formQuote && !opts.includes(formQuote)) {
      return [...opts, formQuote].sort((a, b) => a.localeCompare(b));
    }
    return opts;
  }, [dialogOpen, editRow, formQuote, quoteOptions]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (pickerCodes.length < 2) return;
    if (formQuote !== formBase) return;
    const alt = pickerCodes.find((c) => c !== formBase);
    if (alt) setFormQuote(alt);
  }, [dialogOpen, formBase, formQuote, pickerCodes]);

  useEffect(() => {
    if (!dialogOpen) setFormDatePickerOpen(false);
  }, [dialogOpen]);

  const listQ = useQuery({
    queryKey: ["currency-rates", tenantSlug, from, to, page, limit],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.list,
    queryFn: async () => {
      const sp = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        from,
        to
      });
      const { data } = await api.get<ListResponse>(`/api/${tenantSlug}/currency-rates?${sp}`);
      return data;
    }
  });

  const openCreate = () => {
    const codes = currencyCodes.length > 0 ? currencyCodes : ["UZS"];
    const uniq = Array.from(new Set(codes)).sort((a, b) => a.localeCompare(b));
    setEditRow(null);
    setFormDate(from);
    setFormErr(null);
    setFormFieldErrs({});
    if (uniq.length < 2) {
      setFormBase(uniq[0] ?? "UZS");
      setFormQuote(uniq[0] ?? "UZS");
      setFormRate("");
      setFormSource("manual");
      setFormNote("");
      setFormErr(
        "В справочнике только одна валюта. Добавьте вторую: «Настройки → Валюты», затем откройте форму снова."
      );
      setDialogOpen(true);
      return;
    }
    const hasUsd = uniq.includes("USD");
    const hasUzs = uniq.includes("UZS");
    if (hasUsd && hasUzs) {
      setFormBase("USD");
      setFormQuote("UZS");
    } else {
      setFormBase(uniq[0]!);
      setFormQuote(uniq[1]!);
    }
    setFormRate("");
    setFormSource("manual");
    setFormNote("");
    setDialogOpen(true);
  };

  const openEdit = (r: RateRow) => {
    setEditRow(r);
    setFormDate(r.rate_date);
    setFormBase(r.base_currency);
    setFormQuote(r.quote_currency);
    setFormRate(r.rate);
    setFormSource(r.source ?? "manual");
    setFormNote(r.note ?? "");
    setFormErr(null);
    setFormFieldErrs({});
    setDialogOpen(true);
  };

  const createMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<RateRow>(`/api/${tenantSlug}/currency-rates`, {
        rate_date: formDate.trim(),
        base_currency: formBase.trim(),
        quote_currency: formQuote.trim(),
        rate: formRate.trim(),
        source: formSource.trim() || null,
        note: formNote.trim() || null
      });
      return data;
    },
    onSuccess: () => {
      setDialogOpen(false);
      setFormErr(null);
      setFormFieldErrs({});
      void qc.invalidateQueries({ queryKey: ["currency-rates", tenantSlug] });
    },
    onError: (e: unknown) => {
      setFormFieldErrs(saveErrorFields(e));
      setFormErr(saveErrorMessage(e));
    }
  });

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!editRow) return;
      const { data } = await api.patch<RateRow>(`/api/${tenantSlug}/currency-rates/${editRow.id}`, {
        rate_date: formDate.trim(),
        base_currency: formBase.trim(),
        quote_currency: formQuote.trim(),
        rate: formRate.trim(),
        source: formSource.trim() || null,
        note: formNote.trim() || null
      });
      return data;
    },
    onSuccess: () => {
      setDialogOpen(false);
      setFormErr(null);
      setFormFieldErrs({});
      void qc.invalidateQueries({ queryKey: ["currency-rates", tenantSlug] });
    },
    onError: (e: unknown) => {
      setFormFieldErrs(saveErrorFields(e));
      setFormErr(saveErrorMessage(e));
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/currency-rates/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["currency-rates", tenantSlug] });
    }
  });

  const exportXlsx = useCallback(async () => {
    const rows = listQ.data?.data ?? [];
    await downloadXlsxSheet(
      `currency-rates-${from}_${to}.xlsx`,
      "Курсы",
      ["Дата", "База", "Котировка", "Курс (1 база)", "Источник", "Примечание"],
      rows.map((r) => [r.rate_date, r.base_currency, r.quote_currency, r.rate, r.source ?? "", r.note ?? ""]),
      { colWidths: [12, 10, 12, 18, 14, 28] }
    );
  }, [from, to, listQ.data?.data]);

  if (!hydrated) return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    );
  }

  const totalPages = Math.max(1, Math.ceil((listQ.data?.total ?? 0) / limit));
  const rows = listQ.data?.data ?? [];

  const rateNum = Number.parseFloat(String(formRate).replace(",", "."));
  const rateOk = Number.isFinite(rateNum) && rateNum > 0;
  const pairOk = formBase.trim() !== formQuote.trim() && quoteSelectOptions.length > 0;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(formDate.trim());
  const saveDisabled = createMut.isPending || patchMut.isPending || !pairOk || !rateOk || !dateOk;

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Курс валют"
        description="Журнал курсов по дням: 1 единица базовой валюты = курс в валюте котировки. Коды валют берутся из справочника (Настройки → Валюты)."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border dark:bg-card sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Период</Label>
            <Button
              ref={dateRef}
              type="button"
              variant="outline"
              size="sm"
              className="h-10 min-w-[220px] justify-start gap-2"
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="size-4" />
              {formatDateRangeButton(from, to)}
            </Button>
            <DateRangePopover
              open={dateOpen}
              onOpenChange={setDateOpen}
              anchorRef={dateRef}
              dateFrom={from}
              dateTo={to}
              onApply={({ dateFrom: f, dateTo: t }) => {
                setFrom(f);
                setTo(t);
                setPage(1);
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10"
            onClick={() => {
              const r = monthRange();
              setFrom(r.from);
              setTo(r.to);
              setPage(1);
            }}
          >
            Текущий месяц
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-1"
            onClick={() => void listQ.refetch()}
          >
            <RefreshCw className="size-4" />
            Обновить
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-10 gap-1" onClick={() => void exportXlsx()}>
            <Download className="size-4" />
            Excel
          </Button>
          {canWrite ? (
            <Button
              type="button"
              size="sm"
              className="h-10 gap-1 bg-teal-600 hover:bg-teal-700"
              disabled={profileQ.isLoading}
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Добавить курс
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Справочник валют:{" "}
        <Link href="/settings/currencies" className="text-primary underline underline-offset-2">
          Настройки → Валюты
        </Link>
        .
      </p>

      {listQ.isError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {listLoadErrorMessage(listQ.error)}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card dark:border-border dark:bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-xs font-semibold uppercase text-slate-600 dark:border-border dark:bg-muted/40">
              <th className="px-3 py-2.5">Дата</th>
              <th className="px-3 py-2.5">База</th>
              <th className="px-3 py-2.5">Котировка</th>
              <th className="px-3 py-2.5 text-right">Курс</th>
              <th className="px-3 py-2.5">Источник</th>
              <th className="px-3 py-2.5">Примечание</th>
              {canWrite ? <th className="px-3 py-2.5 text-right">Действия</th> : null}
            </tr>
          </thead>
          <tbody>
            {listQ.isFetching ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-3 py-8 text-center text-muted-foreground">
                  Нет записей за период. {canWrite ? "Нажмите «Добавить курс»." : ""}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border dark:border-border">
                  <td className="px-3 py-2 tabular-nums">{r.rate_date}</td>
                  <td className="px-3 py-2 font-medium">{r.base_currency}</td>
                  <td className="px-3 py-2 font-medium">{r.quote_currency}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtRate(r.rate)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.source ?? "—"}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={r.note ?? ""}>
                    {r.note ?? "—"}
                  </td>
                  {canWrite ? (
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label="Изменить"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          aria-label="Удалить"
                          disabled={deleteMut.isPending}
                          onClick={() => {
                            if (!window.confirm(`Удалить курс ${r.base_currency}/${r.quote_currency} на ${r.rate_date}?`))
                              return;
                            deleteMut.mutate(r.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Стр. {page} из {totalPages} · всего {listQ.data?.total ?? 0}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Назад
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Вперёд
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editRow ? "Изменить курс" : "Новый курс"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {pickerCodes.length < 2 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                Для курса нужны минимум две валюты в справочнике.{" "}
                <Link href="/settings/currencies" className="font-medium underline underline-offset-2">
                  Настройки → Валюты
                </Link>
              </p>
            ) : null}
            <div className="space-y-1">
              <Label>Дата (курс на день)</Label>
              <Button
                ref={formDateRef}
                type="button"
                variant="outline"
                className={cn(
                  "h-10 w-full justify-start gap-2 font-normal",
                  formDatePickerOpen && "border-primary/60 bg-primary/5"
                )}
                aria-expanded={formDatePickerOpen}
                aria-haspopup="dialog"
                onClick={() => setFormDatePickerOpen((o) => !o)}
              >
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate tabular-nums">{formatRuDateButton(formDate) || "дд.мм.гггг"}</span>
              </Button>
              <DatePickerPopover
                open={formDatePickerOpen}
                onOpenChange={setFormDatePickerOpen}
                anchorRef={formDateRef}
                value={formDate}
                onChange={(iso) => setFormDate(iso.trim() ? iso : localYmd(new Date()))}
              />
              {pickZodLeaf(formFieldErrs, "rate_date") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "rate_date")}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>База (1 ед.)</Label>
                <select
                  className={cn(
                    "flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                  )}
                  value={formBase}
                  onChange={(e) => setFormBase(e.target.value)}
                >
                  {pickerCodes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {pickZodLeaf(formFieldErrs, "base_currency") ? (
                  <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "base_currency")}</p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label>В котировке</Label>
                {quoteSelectOptions.length > 0 ? (
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm"
                    value={formQuote}
                    onChange={(e) => setFormQuote(e.target.value)}
                  >
                    {quoteSelectOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-2 text-sm text-muted-foreground">
                    Нет второй валюты в справочнике
                  </div>
                )}
                {pickZodLeaf(formFieldErrs, "quote_currency") ? (
                  <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "quote_currency")}</p>
                ) : null}
              </div>
            </div>
            {formBase.trim() === formQuote.trim() && pickerCodes.length >= 2 ? (
              <p className="text-xs text-destructive">Выберите разные валюты для базы и котировки.</p>
            ) : null}
            <div className="space-y-1">
              <Label>Курс</Label>
              <GroupedNumberInput
                maxFractionDigits={6}
                placeholder="например 12 550"
                value={formRate}
                onValueChange={setFormRate}
              />
              <p className="text-xs text-muted-foreground">
                1 {formBase} = {formRate || "…"} {formQuote}
              </p>
              {pickZodLeaf(formFieldErrs, "rate") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "rate")}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Источник</Label>
              <Input value={formSource} onChange={(e) => setFormSource(e.target.value)} placeholder="manual, CBU…" />
              {pickZodLeaf(formFieldErrs, "source") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "source")}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Примечание</Label>
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} />
              {pickZodLeaf(formFieldErrs, "note") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(formFieldErrs, "note")}</p>
              ) : null}
            </div>
            {formErr ? <p className="text-sm text-destructive">{formErr}</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              disabled={saveDisabled}
              onClick={() => {
                setFormErr(null);
                setFormFieldErrs({});
                if (editRow) patchMut.mutate();
                else createMut.mutate();
              }}
            >
              {createMut.isPending || patchMut.isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
