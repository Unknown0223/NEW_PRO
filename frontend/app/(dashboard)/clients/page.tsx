"use client";

import { ClientsDataTable } from "@/components/clients/clients-data-table";
import {
  ClientsListPagination,
  ClientsTemplateListToolbar
} from "@/components/clients/clients-table-toolbar";
import { ClientsTemplateFiltersPanel } from "@/components/clients/clients-template-filters-panel";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { PageShell } from "@/components/dashboard/page-shell";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/lib/client-types";
import { CLIENT_COLUMN_TO_SORT, type ClientSortField } from "@/lib/client-list-sort";
import {
  CLIENT_TABLE_COLUMNS,
  CLIENT_TABLE_PREF_COLUMN_IDS,
  getDefaultColumnVisibility,
  getDefaultHiddenClientColumnIds,
  loadColumnVisibility,
  type ClientColumnId
} from "@/lib/client-table-columns";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import {
  appendClientListFilterParams,
  INITIAL_CLIENT_TOOLBAR_FILTERS,
  type ClientListFilterBundle,
  type ClientToolbarFiltersState
} from "@/lib/client-list-toolbar-filters";
import { CLIENT_IMPORT_MAX_FILE_BYTES } from "@/lib/client-import-limits";
import { mergeRefOptions } from "@/lib/merge-ref-options";
import { mergeRefSelectOptions, optionsToValueLabelMap } from "@/lib/ref-select-options";
import { buildZoneRegionCityCascadeOptions, type ClientRefsTerritoryBundle } from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { api, apiBaseURL } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { clientsFilterDebugEnabled, logClientsFilters } from "@/lib/clients-filter-debug";
import {
  ClientImportMappingDialog,
  type ClientImportMappingPayload
} from "@/components/clients/client-import-mapping-dialog";
import { ClientImportLaunchDialog } from "@/components/clients/client-import-launch-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { isAxiosError, type AxiosProgressEvent } from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

type ClientsResponse = {
  data: ClientRow[];
  total: number;
  page: number;
  limit: number;
};

type ClientImportUiStage =
  | "idle"
  | "uploading"
  | "queued"
  | "parsing"
  | "resolving"
  | "writing"
  | "finalizing"
  | "done"
  | "failed";

type ClientImportProgressState = {
  stage: ClientImportUiStage;
  percent: number;
  processedRows: number;
  totalRows: number;
  message?: string;
};
type LinkageScope = {
  selected_agent_id: number | null;
  constrained: boolean;
  expeditor_ids: number[];
};

type ClientImportApiResult = {
  created: number;
  updated?: number;
  errors: string[];
  importStats?: {
    totalRows: number;
    processedRows: number;
    skippedDuplicate: number;
    skippedEmpty: number;
  };
};

type BackgroundJobStatusDto = {
  id: string;
  state: string;
  failedReason?: string;
  returnvalue?: ClientImportApiResult;
  workersConnected?: number;
  progress?: {
    stage?: string;
    percent?: number;
    processedRows?: number;
    totalRows?: number;
    message?: string;
  };
};

type ClientRefOptionDto = { value: string; label: string };

type ClientReferencesResponse = {
  categories: string[];
  client_type_codes: string[];
  regions: string[];
  cities: string[];
  districts: string[];
  neighborhoods: string[];
  zones: string[];
  client_formats: string[];
  sales_channels: string[];
  product_category_refs: string[];
  logistics_services: string[];
  equipment_filter_values?: string[];
  category_options?: ClientRefOptionDto[];
  client_type_options?: ClientRefOptionDto[];
  client_format_options?: ClientRefOptionDto[];
  sales_channel_options?: ClientRefOptionDto[];
  city_options?: ClientRefOptionDto[];
  region_options?: ClientRefOptionDto[];
  city_territory_hints?: Record<
    string,
    {
      region_stored: string | null;
      region_label: string | null;
      zone_stored: string | null;
      zone_label: string | null;
      district_stored: string | null;
      district_label: string | null;
    }
  >;
};

const CLIENTS_LIST_TABLE_ID = "clients.list.v1";
const CLIENTS_DEFAULT_HIDDEN_COLUMN_IDS = getDefaultHiddenClientColumnIds();
const CLIENT_MANAGEABLE_COLUMNS = CLIENT_TABLE_COLUMNS.filter((c) => c.id !== "_actions");

function sanitizeToolbarForApi(t: ClientToolbarFiltersState): ClientToolbarFiltersState {
  return { ...t };
}

export default function ClientsPage() {
  const router = useRouter();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ClientImportProgressState | null>(null);
  const [importMapOpen, setImportMapOpen] = useState(false);
  const [importDialogMode, setImportDialogMode] = useState<"create" | "update">("create");
  const [importLaunchOpen, setImportLaunchOpen] = useState(false);
  const [importLaunchMode, setImportLaunchMode] = useState<"create" | "update">("create");
  const [importStagingFile, setImportStagingFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedToolbar, setAppliedToolbar] = useState<ClientToolbarFiltersState>(() => ({
    ...INITIAL_CLIENT_TOOLBAR_FILTERS
  }));
  const [draftToolbar, setDraftToolbar] = useState<ClientToolbarFiltersState>(() => ({
    ...INITIAL_CLIENT_TOOLBAR_FILTERS
  }));
  const [sortField, setSortField] = useState<ClientSortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [showSessionLoadingHint, setShowSessionLoadingHint] = useState(false);
  const clientsPrefsMigrated = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("salesdoc.clients.filterDebug") === "1") return;
      if (sessionStorage.getItem("salesdoc.clients.filterHint") === "1") return;
      sessionStorage.setItem("salesdoc.clients.filterHint", "1");
    } catch {
      /* ignore */
    }
    console.info(
      '[clients/filters] Diagnostika: localStorage.setItem("salesdoc.clients.filterDebug","1") keyin sahifani yangilang — har bir so‘rov konsolga chiqadi.'
    );
  }, []);

  useEffect(() => {
    if (authHydrated) {
      setShowSessionLoadingHint(false);
      return;
    }
    const t = window.setTimeout(() => {
      setShowSessionLoadingHint(true);
    }, 3500);
    return () => window.clearTimeout(t);
  }, [authHydrated]);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: CLIENTS_LIST_TABLE_ID,
    defaultColumnOrder: CLIENT_TABLE_PREF_COLUMN_IDS,
    defaultPageSize: 15,
    allowedPageSizes: [10, 15, 20, 25, 30, 50, 100, 500],
    defaultHiddenColumnIds: CLIENTS_DEFAULT_HIDDEN_COLUMN_IDS
  });
  useEffect(() => {
    if (!tenantSlug || clientsPrefsMigrated.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ data: { tables?: Record<string, unknown> } }>(
          `/api/${tenantSlug}/me/ui-preferences`
        );
        if (cancelled) return;
        if (data.data.tables?.[CLIENTS_LIST_TABLE_ID]) {
          clientsPrefsMigrated.current = true;
          return;
        }
        const ls = loadColumnVisibility();
        const hidden = CLIENT_TABLE_PREF_COLUMN_IDS.filter((id) => !ls[id]);
        await api.patch(`/api/${tenantSlug}/me/ui-preferences`, {
          tables: {
            [CLIENTS_LIST_TABLE_ID]: {
              columnOrder: [...CLIENT_TABLE_PREF_COLUMN_IDS],
              hiddenColumnIds: hidden,
              pageSize: 15
            }
          }
        });
        clientsPrefsMigrated.current = true;
        await qc.invalidateQueries({ queryKey: ["me", "ui-preferences", tenantSlug] });
      } catch {
        clientsPrefsMigrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, qc]);

  const filterBundleForApi = useMemo<ClientListFilterBundle>(
    () => ({
      ...sanitizeToolbarForApi(appliedToolbar),
      search,
      sortField,
      sortOrder
    }),
    [appliedToolbar, search, sortField, sortOrder]
  );

  const prevSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSearchRef.current === null) {
      prevSearchRef.current = search;
      return;
    }
    if (prevSearchRef.current === search) return;
    prevSearchRef.current = search;
    setPage(1);
  }, [search]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tenantSlug, search, appliedToolbar, sortField, sortOrder, tablePrefs.pageSize]);

  const normalizeImportProgress = (raw: {
    stage?: string;
    percent?: number;
    processedRows?: number;
    totalRows?: number;
    message?: string;
  }): ClientImportProgressState => {
    const stage =
      raw.stage === "uploading" ||
      raw.stage === "queued" ||
      raw.stage === "parsing" ||
      raw.stage === "resolving" ||
      raw.stage === "writing" ||
      raw.stage === "finalizing" ||
      raw.stage === "done" ||
      raw.stage === "failed"
        ? raw.stage
        : "queued";
    const percent = Number.isFinite(raw.percent) ? Number(raw.percent) : 0;
    const processedRows = Number.isFinite(raw.processedRows) ? Number(raw.processedRows) : 0;
    const totalRows = Number.isFinite(raw.totalRows) ? Number(raw.totalRows) : 0;
    return {
      stage,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      processedRows: Math.max(0, Math.floor(processedRows)),
      totalRows: Math.max(0, Math.floor(totalRows)),
      message: raw.message
    };
  };

  const buildImportSummaryMessage = (data: ClientImportApiResult): string => {
    const errPart =
      data.errors.length > 0
        ? ` Сообщения сервера (${data.errors.length}): ${data.errors.slice(0, 3).join("; ")}${data.errors.length > 3 ? "…" : ""}`
        : "";
    const c = data.created ?? 0;
    const u = data.updated ?? 0;
    const st = data.importStats;
    const dup = st?.skippedDuplicate ?? 0;
    const empty = st?.skippedEmpty ?? 0;
    let statPart = "";
    if (st != null && st.totalRows > 0) {
      statPart = ` В файле строк: ${st.totalRows}, обработано: ${st.processedRows}.`;
      if (dup > 0) {
        statPart += ` Пропущено как дубликат (код/PINFL/ИНН или телефон+название): ${dup}.`;
      }
      if (empty > 0) {
        statPart += ` Пропущено пустых/без имени: ${empty}.`;
      }
      if (dup > 0 || empty > 0) {
        const accounted = c + u + dup + empty;
        statPart += ` Сумма: ${c} + ${u} + ${dup} + ${empty} = ${accounted} (с обработанными строками).`;
      }
    }
    const summary =
      c > 0 && u > 0
        ? `Добавлено: ${c}. Обновлено: ${u}.`
        : c > 0
          ? `Добавлено: ${c}.`
          : u > 0
            ? `Обновлено: ${u}.`
            : "Изменений по строкам нет.";
    return `${summary}${statPart}${errPart}`;
  };

  /** Brauzer konsolida importni tahlil qilish: barcha qatorlar nima uchun qo‘shilmaganini ko‘rish. */
  const logClientImport = (phase: string, payload?: unknown) => {
    console.info(`[clients import] ${phase}`, payload ?? "");
  };

  const logClientImportResultAnalysis = (data: ClientImportApiResult, meta: { jobId?: string } = {}) => {
    const st = data.importStats;
    const errs = data.errors ?? [];
    const perfLines = errs.filter((e) => e.includes("Import stats:"));
    const rowLike = errs.filter(
      (e) =>
        /Qator\s+\d+/i.test(e) ||
        /строк/i.test(e) ||
        /Excel/i.test(e) ||
        /Unique constraint/i.test(e)
    );
    const summaryOrWarn = errs.filter((e) => !perfLines.includes(e) && !rowLike.includes(e));

    logClientImport("tahlil — server javobi (yakuniy)", {
      jobId: meta.jobId,
      created: data.created ?? 0,
      updated: data.updated ?? 0,
      importStats: st ?? null
    });

    if (st && st.totalRows > 0) {
      const cr = data.created ?? 0;
      const up = data.updated ?? 0;
      const sumParts = cr + up + st.skippedDuplicate + st.skippedEmpty;
      logClientImport("tahlil — qatorlar balansi (nimaga barcha qator DBga tushmagan bo‘lishi mumkin)", {
        exceldaHisoblanganMaqsadQatorlar: st.totalRows,
        importTsikldaQaytaIshlangan: st.processedRows,
        yaratilganYokiYangilangan: cr + up,
        otkazilganDublikat: st.skippedDuplicate,
        otkazilganBoshYokiNameYoqsiz: st.skippedEmpty,
        tenglama: `${cr} + ${up} + ${st.skippedDuplicate} + ${st.skippedEmpty} = ${sumParts} (processedRows bilan solishtiring)`,
        xabarlarVaXatolarSoni: errs.length,
        izoh:
          st.processedRows !== st.totalRows
            ? "processedRows < totalRows — fayl/paragraf cheklovi yoki hisoblash farqi (backend estimateImportTotalRows)."
            : "processedRows totalRows ga teng — barcha maqsad qatorlar tsikl bo‘yicha yuritilgan.",
        eslatma:
          "Dublikat: DBda yoki shu importdagi oldingi qator bilan bir xil kod/PINFL/INN yoki telefon+nom. Yangi yozuv emas — bu xato emas."
      });
      console.table({
        totalRows: st.totalRows,
        processedRows: st.processedRows,
        skippedDuplicate: st.skippedDuplicate,
        skippedEmpty: st.skippedEmpty,
        created: cr,
        updated: up
      });
    }

    logClientImport("xabarlar va xatolar — TO‘LIQ ro‘yxat (server errors massivi)", errs);
    if (rowLike.length > 0) {
      logClientImport("qator-boyicha xatolar (filtrlangan)", rowLike);
    }
    if (summaryOrWarn.length > 0) {
      logClientImport("umumiy xabarlar / ogohlantirishlar (filtrlangan)", summaryOrWarn);
    }
    if (perfLines.length > 0) {
      logClientImport("server performance", perfLines);
    }
  };

  const importMut = useMutation({
    mutationFn: async (payload: { file: File; importMode: "create" | "update" } & ClientImportMappingPayload) => {
      if (!tenantSlug) throw new Error("TenantRequired");
      logClientImport("boshlash", {
        fayl: payload.file.name,
        hajmBytes: payload.file.size,
        importMode: payload.importMode,
        sheetName: payload.sheetName,
        headerRowIndex: payload.headerRowIndex,
        columnMap: payload.columnMap,
        duplicateKeyFields: payload.duplicateKeyFields,
        updateApplyFields: payload.updateApplyFields,
        importUrlMode:
          process.env.NODE_ENV === "development" && !apiBaseURL ? "direct-18080" : "proxy-or-apiBase"
      });
      const fd = new FormData();
      fd.append("file", payload.file);
      fd.append("columnMap", JSON.stringify(payload.columnMap));
      fd.append("sheetName", payload.sheetName);
      fd.append("headerRowIndex", String(payload.headerRowIndex));
      fd.append("importMode", payload.importMode);
      if (payload.duplicateKeyFields != null && payload.duplicateKeyFields.length > 0) {
        fd.append("duplicateKeyFields", JSON.stringify(payload.duplicateKeyFields));
      }
      if (payload.updateApplyFields != null && payload.updateApplyFields.length > 0) {
        fd.append("updateApplyFields", JSON.stringify(payload.updateApplyFields));
      }
      const importPath = `/api/${tenantSlug}/clients/import/async`;
      // Devda katta fayllar Next proxy timeoutiga tushmasligi uchun importni backendga bevosita yuboramiz.
      const importUrl =
        process.env.NODE_ENV === "development" && !apiBaseURL
          ? `http://127.0.0.1:18080${importPath}`
          : importPath;
      const jobStatusBase =
        process.env.NODE_ENV === "development" && !apiBaseURL ? "http://127.0.0.1:18080" : "";
      setImportProgress({
        stage: "uploading",
        percent: 0,
        processedRows: 0,
        totalRows: 0,
        message: "Файл загружается..."
      });
      const { data: enqueueRes } = await api.post<{ jobId: string }>(importUrl, fd, {
        onUploadProgress: (evt: AxiosProgressEvent) => {
          const loaded = evt.loaded ?? 0;
          const total = evt.total ?? payload.file.size;
          const pct = total > 0 ? (loaded / total) * 100 : 0;
          const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
          setImportProgress((prev) =>
            normalizeImportProgress({
              ...prev,
              stage: "uploading",
              percent: Math.min(99, pct),
              processedRows: 0,
              totalRows: 0,
              message: total > 0 ? `Файл: ${mb(loaded)} / ${mb(total)} MB` : "Файл загружается..."
            })
          );
        }
      });
      const jobId = String(enqueueRes.jobId ?? "").trim();
      if (!jobId) throw new Error("ImportJobIdMissing");
      logClientImport("navbatga qo‘yildi (jobId)", {
        jobId,
        statusUrl: `${jobStatusBase}/api/${tenantSlug}/jobs/${jobId}`
      });
      setImportProgress(
        normalizeImportProgress({
          stage: "queued",
          percent: 2,
          processedRows: 0,
          totalRows: 0,
          message: "Задача поставлена в очередь."
        })
      );

      let attempt = 0;
      let lastJobState: string | undefined;
      /** Katta .xlsx import uzoq davom etishi mumkin (40k+ qator, qator uchun alohida tranzaksiya). */
      const maxAttempts = 8000;
      const pollDelayMs = 1500;
      while (attempt < maxAttempts) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, pollDelayMs));
        let job: BackgroundJobStatusDto;
        try {
          const { data } = await api.get<BackgroundJobStatusDto>(
            `${jobStatusBase}/api/${tenantSlug}/jobs/${jobId}`
          );
          job = data;
        } catch (err) {
          if (isAxiosError(err)) {
            const st = err.response?.status;
            if (st === 401 || st === 403) {
              throw new Error("Import status uchun sessiya muddati tugagan. Qayta login qiling.");
            }
            if (st === 404) {
              throw new Error("Import vazifasi topilmadi yoki navbatdan o‘chgan.");
            }
            if (st === 503) {
              throw new Error("Job navbati/Redis vaqtincha mavjud emas.");
            }
          }
          throw err;
        }
        const stateChanged = job.state !== lastJobState;
        const heartbeat = attempt % 25 === 0;
        if (stateChanged) {
          logClientImport("job holati o‘zgardi", {
            attempt,
            jobId,
            state: job.state,
            progress: job.progress ?? null,
            failedReason: job.failedReason
          });
          lastJobState = job.state;
        } else if (heartbeat && job.state !== "completed" && job.state !== "failed") {
          logClientImport("progress (har 25 ta so‘rovda bir marta)", {
            attempt,
            jobId,
            state: job.state,
            progress: job.progress ?? null
          });
        }
        if (job.progress) {
          setImportProgress(
            normalizeImportProgress({
              stage: job.progress.stage,
              percent: job.progress.percent,
              processedRows: job.progress.processedRows,
              totalRows: job.progress.totalRows,
              message: job.progress.message
            })
          );
        } else if (job.state === "active") {
          setImportProgress(
            normalizeImportProgress({
              stage: "writing",
              percent: 15,
              processedRows: 0,
              totalRows: 0
            })
          );
        }

        if (
          (job.state === "waiting" || job.state === "delayed") &&
          job.workersConnected === 0 &&
          attempt >= 8
        ) {
          throw new Error(
            "Import navbati ishlamayapti: background worker yo‘q. Backend qayta deploy qiling (worker bilan) yoki admin bilan bog‘laning."
          );
        }

        if (job.state === "completed") {
          const result = job.returnvalue as ClientImportApiResult | undefined;
          if (!result || !Array.isArray(result.errors)) {
            const bad: ClientImportApiResult = {
              created: 0,
              updated: 0,
              errors: ["Import yakunlandi, lekin javob formati noto‘g‘ri."]
            };
            logClientImport("yakun: noto‘g‘ri returnvalue", { jobId, raw: job.returnvalue });
            logClientImportResultAnalysis(bad, { jobId });
            return bad;
          }
          logClientImport("yakun: job completed", { jobId });
          logClientImportResultAnalysis(result, { jobId });
          return result;
        }
        if (job.state === "failed") {
          logClientImport("job failed", { jobId, failedReason: job.failedReason });
          throw new Error(job.failedReason || "ImportFailed");
        }
      }
      logClientImport("polling timeout", { jobId, maxAttempts, pollDelayMs });
      throw new Error("ImportPollingTimeout");
    },
    onSuccess: async (data) => {
      logClientImport("UI onSuccess (tahlil yuqorida mutation yakunida yozilgan bo‘lishi kerak)", {
        errorsCount: data.errors.length
      });
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["clients-references", tenantSlug] });
      setImportProgress((prev) =>
        normalizeImportProgress({
          ...prev,
          stage: "done",
          percent: 100,
          message: "Импорт завершен."
        })
      );
      setImportMsg(buildImportSummaryMessage(data));
      setImportMapOpen(false);
      setImportStagingFile(null);
    },
    onError: (e: unknown) => {
      console.error("[clients import] xato", e);
      setImportProgress((prev) =>
        normalizeImportProgress({
          ...prev,
          stage: "failed",
          percent: 100,
          message: getUserFacingError(e, "Ошибка импорта.")
        })
      );
      if (isAxiosError(e)) {
        const st = e.response?.status;
        const data = e.response?.data as
          | { error?: string; message?: string; maxBytes?: number }
          | undefined;
        console.error("[clients import] javob", { status: st, data });
        if (st === 413) {
          const mb = data?.maxBytes ? Math.round(data.maxBytes / (1024 * 1024)) : 50;
          setImportMsg(
            getUserFacingError(
              e,
              data?.message ??
                `Файл слишком велик (лимит сервера ~${mb} MB). Уменьшите файл или увеличьте MULTIPART_MAX_FILE_BYTES в .env на сервере.`
            )
          );
          return;
        }
        if (st === 403) {
          setImportMsg(getUserFacingError(e, "Нет доступа (только администратор или оператор)."));
          return;
        }
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        const hint = flat ? firstValidationUserHint(flat) : undefined;
        if (hint) {
          setImportMsg(withApiSupportLine(hint, e));
          return;
        }
        if (data?.message) {
          setImportMsg(getUserFacingError(e, data.message));
          return;
        }
      }
      setImportMsg(
        getUserFacingError(
          e,
          "Ошибка импорта: .xlsx, 1 лист, 1 строка заголовков (name / название / RU: имя). Консоль: F12."
        )
      );
    }
  });

  const { data, isLoading, isError, error, refetch, isFetching, isPlaceholderData } = useQuery({
    queryKey: [
      "clients",
      tenantSlug,
      page,
      search,
      appliedToolbar,
      sortField,
      sortOrder,
      tablePrefs.pageSize
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(tablePrefs.pageSize)
      });
      appendClientListFilterParams(params, filterBundleForApi);
      const qs = params.toString();
      logClientsFilters("request", {
        tenantSlug,
        url: `/api/${tenantSlug}/clients?${qs}`,
        queryParams: Object.fromEntries(params.entries()),
        filters: { ...filterBundleForApi }
      });
      try {
        const { data: body } = await api.get<ClientsResponse>(`/api/${tenantSlug}/clients?${qs}`);
        logClientsFilters("response", {
          total: body.total,
          returnedRows: body.data.length,
          page: body.page,
          limit: body.limit
        });
        return body;
      } catch (e) {
        logClientsFilters("request_failed", {
          queryParams: Object.fromEntries(params.entries()),
          error: getUserFacingError(e, "unknown")
        });
        throw e;
      }
    }
  });

  const refsQ = useQuery({
    queryKey: ["clients-references", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientReferencesResponse>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  const refData = refsQ.data;

  const profileQ = useQuery({
    queryKey: ["clients-page", "settings-profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: { territory_nodes?: TerritoryNode[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const territoryRefsBundle = useMemo((): ClientRefsTerritoryBundle | undefined => {
    const d = refData;
    if (!d) return undefined;
    return {
      regions: d.regions,
      cities: d.cities,
      zones: d.zones,
      region_options: d.region_options,
      city_options: d.city_options
    };
  }, [refData]);

  const territoryCascade = useMemo(
    () =>
      buildZoneRegionCityCascadeOptions(
        territoryRefsBundle,
        undefined,
        profileQ.data?.territory_nodes,
        {
          zone: draftToolbar.zoneFilter,
          region: draftToolbar.regionFilter,
          city: draftToolbar.cityFilter
        }
      ),
    [
      territoryRefsBundle,
      profileQ.data?.territory_nodes,
      draftToolbar.zoneFilter,
      draftToolbar.regionFilter,
      draftToolbar.cityFilter
    ]
  );

  const clientsTerritoryZoneKeys = useMemo(
    () => new Set(territoryCascade.zones.map((o) => normTrim(o.value))),
    [territoryCascade.zones]
  );
  const clientsTerritoryRegionKeys = useMemo(
    () => new Set(territoryCascade.regions.map((o) => normTrim(o.value))),
    [territoryCascade.regions]
  );
  const clientsTerritoryCityKeys = useMemo(
    () => new Set(territoryCascade.cities.map((o) => normTrim(o.value))),
    [territoryCascade.cities]
  );

  useEffect(() => {
    const z = normTrim(draftToolbar.zoneFilter);
    if (!z) return;
    if (!clientsTerritoryZoneKeys.has(z)) {
      setDraftToolbar((d) => ({ ...d, zoneFilter: "", regionFilter: "", cityFilter: "" }));
    }
  }, [clientsTerritoryZoneKeys, draftToolbar.zoneFilter]);

  useEffect(() => {
    const r = normTrim(draftToolbar.regionFilter);
    if (!r) return;
    if (!clientsTerritoryRegionKeys.has(r)) {
      setDraftToolbar((d) => ({ ...d, regionFilter: "", cityFilter: "" }));
    }
  }, [clientsTerritoryRegionKeys, draftToolbar.regionFilter]);

  useEffect(() => {
    const c = normTrim(draftToolbar.cityFilter);
    if (!c) return;
    if (!clientsTerritoryCityKeys.has(c)) {
      setDraftToolbar((d) => ({ ...d, cityFilter: "" }));
    }
  }, [clientsTerritoryCityKeys, draftToolbar.cityFilter]);

  useEffect(() => {
    if (!refData || !clientsFilterDebugEnabled()) return;
    logClientsFilters("references_loaded", {
      category_options: refData.category_options?.length ?? 0,
      client_type_options: refData.client_type_options?.length ?? 0,
      client_format_options: refData.client_format_options?.length ?? 0,
      sales_channel_options: refData.sales_channel_options?.length ?? 0,
      region_options: refData.region_options?.length ?? 0,
      city_options: refData.city_options?.length ?? 0,
      city_territory_hint_keys: Object.keys(refData.city_territory_hints ?? {}).length,
      legacy_lists: {
        regions: refData.regions?.length ?? 0,
        districts: refData.districts?.length ?? 0,
        zones: refData.zones?.length ?? 0,
        cities: refData.cities?.length ?? 0
      }
    });
  }, [refData]);

  const categorySelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.category_options?.length) {
      return mergeRefSelectOptions(draftToolbar.categoryFilter, refData.category_options, refData.categories);
    }
    return mergeRefOptions(draftToolbar.categoryFilter, refData.categories).map((v) => ({ value: v, label: v }));
  }, [refData, draftToolbar.categoryFilter]);

  const clientTypeSelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.client_type_options?.length) {
      return mergeRefSelectOptions(
        draftToolbar.clientTypeFilter,
        refData.client_type_options,
        refData.client_type_codes
      );
    }
    return mergeRefOptions(draftToolbar.clientTypeFilter, refData.client_type_codes).map((v) => ({
      value: v,
      label: v
    }));
  }, [refData, draftToolbar.clientTypeFilter]);

  const clientFormatSelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.client_format_options?.length) {
      return mergeRefSelectOptions(
        draftToolbar.clientFormatFilter,
        refData.client_format_options,
        refData.client_formats
      );
    }
    return mergeRefOptions(draftToolbar.clientFormatFilter, refData.client_formats).map((v) => ({
      value: v,
      label: v
    }));
  }, [refData, draftToolbar.clientFormatFilter]);

  const salesChannelSelectOptions = useMemo(() => {
    if (!refData) return [];
    if (refData.sales_channel_options?.length) {
      return mergeRefSelectOptions(
        draftToolbar.salesChannelFilter,
        refData.sales_channel_options,
        refData.sales_channels
      );
    }
    return mergeRefOptions(draftToolbar.salesChannelFilter, refData.sales_channels).map((v) => ({
      value: v,
      label: v
    }));
  }, [refData, draftToolbar.salesChannelFilter]);

  const equipmentSelectOptions = useMemo(() => {
    if (!refData?.equipment_filter_values?.length) return [];
    return refData.equipment_filter_values.map((v) => ({ value: v, label: v }));
  }, [refData?.equipment_filter_values]);

  const refDisplayMaps = useMemo(() => {
    if (!refData) return undefined;
    const strListToMap = (arr: string[] | undefined): Record<string, string> | undefined => {
      if (!arr?.length) return undefined;
      const m: Record<string, string> = {};
      for (const s of arr) {
        const t = s.trim();
        if (t) m[t] = t;
      }
      return Object.keys(m).length ? m : undefined;
    };
    return {
      category: optionsToValueLabelMap(refData.category_options),
      clientType: optionsToValueLabelMap(refData.client_type_options),
      clientFormat: optionsToValueLabelMap(refData.client_format_options),
      salesChannel: optionsToValueLabelMap(refData.sales_channel_options),
      city: optionsToValueLabelMap(refData.city_options),
      region: optionsToValueLabelMap(refData.region_options),
      district: strListToMap(refData.districts),
      zone: strListToMap(refData.zones),
      cityTerritoryHints: refData.city_territory_hints
    };
  }, [refData]);

  const agentsFilterQ = useQuery({
    queryKey: ["agents", tenantSlug, "clients-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/agents`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const expeditorsFilterQ = useQuery({
    queryKey: ["expeditors", tenantSlug, "clients-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/expeditors`);
      return data.data
        .filter((r) => r.is_active)
        .map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });
  const selectedAgentForScopeNum = draftToolbar.agentFilter.trim()
    ? Number.parseInt(draftToolbar.agentFilter.trim(), 10)
    : NaN;
  const clientsLinkageQ = useQuery({
    queryKey: [
      "linkage-options",
      tenantSlug,
      "clients-toolbar",
      Number.isFinite(selectedAgentForScopeNum) && selectedAgentForScopeNum > 0
        ? selectedAgentForScopeNum
        : null
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      if (!Number.isFinite(selectedAgentForScopeNum) || selectedAgentForScopeNum < 1) return null;
      const { data } = await api.get<{ data: LinkageScope }>(
        `/api/${tenantSlug}/linkage/options?selected_agent_id=${selectedAgentForScopeNum}`
      );
      return data.data;
    }
  });
  const filteredExpeditorOptions = useMemo(() => {
    const all = expeditorsFilterQ.data ?? [];
    const scope = clientsLinkageQ.data;
    if (!scope?.constrained) return all;
    const allowed = new Set(scope.expeditor_ids);
    return all.filter((row) => allowed.has(row.id));
  }, [expeditorsFilterQ.data, clientsLinkageQ.data]);

  const supervisorsFilterQ = useQuery({
    queryKey: ["supervisors", tenantSlug, "clients-toolbar"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{
        data: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
      }>(`/api/${tenantSlug}/supervisors?is_active=true`);
      return data.data.map((r) => ({ id: r.id, name: r.fio, login: r.login }));
    }
  });

  const onToolbarDraftChange = (patch: Partial<ClientToolbarFiltersState>) => {
    setDraftToolbar((prev) => {
      const next = { ...prev, ...patch };
      if (patch.zoneFilter !== undefined && patch.zoneFilter !== prev.zoneFilter) {
        next.regionFilter = "";
        next.cityFilter = "";
      }
      if (patch.regionFilter !== undefined && patch.regionFilter !== prev.regionFilter) {
        next.cityFilter = "";
      }
      return next;
    });
  };
  useEffect(() => {
    if (!draftToolbar.expeditorFilter.trim()) return;
    const ok = filteredExpeditorOptions.some((r) => String(r.id) === draftToolbar.expeditorFilter.trim());
    if (!ok) {
      setDraftToolbar((prev) => ({ ...prev, expeditorFilter: "" }));
    }
  }, [draftToolbar.expeditorFilter, filteredExpeditorOptions]);

  const handleApplyToolbarFilters = () => {
    setAppliedToolbar({ ...draftToolbar });
    setPage(1);
  };

  const handleResetToolbarFilters = () => {
    const cleared = { ...INITIAL_CLIENT_TOOLBAR_FILTERS };
    setDraftToolbar(cleared);
    setAppliedToolbar(cleared);
    setPage(1);
  };

  const handleDateRangeApplied = useCallback((dateFrom: string, dateTo: string) => {
    setDraftToolbar((prev) => {
      const next = { ...prev, createdFrom: dateFrom, createdTo: dateTo };
      setAppliedToolbar(next);
      setPage(1);
      return next;
    });
  }, []);

  const rows = data?.data ?? [];
  const visibleColumnOrder = tablePrefs.visibleColumnOrder;

  const clientsTotalPages = useMemo(() => {
    if (!data) return 1;
    const lim = data.limit > 0 ? data.limit : tablePrefs.pageSize;
    return Math.max(1, Math.ceil(data.total / lim));
  }, [data, tablePrefs.pageSize]);

  const handleSortByColumn = (columnId: ClientColumnId) => {
    const api = CLIENT_COLUMN_TO_SORT[columnId];
    if (!api) {
      logClientsFilters("sort_skip", { columnId, reason: "no backend sort field" });
      return;
    }
    const nextOrder = sortField === api ? (sortOrder === "asc" ? "desc" : "asc") : "asc";
    logClientsFilters("sort_change", { columnId, sortField: api, order: nextOrder });
    if (sortField === api) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(api);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const openImportLaunch = (mode: "create" | "update") => {
    setImportLaunchMode(mode);
    setImportLaunchOpen(true);
    setImportMsg(null);
    setImportProgress(null);
  };

  const downloadImportTemplate = async (mode: "create" | "update") => {
    if (!tenantSlug) return;
    setImportMsg(null);
    try {
      if (mode === "create") {
        const res = await api.get(`/api/${tenantSlug}/clients/import/template`, {
          responseType: "blob"
        });
        const blob = new Blob([res.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "clients_import_template.xlsx";
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const params = new URLSearchParams();
      appendClientListFilterParams(params, filterBundleForApi);
      const res = await api.get(`/api/${tenantSlug}/clients/import-update-template?${params.toString()}`, {
        responseType: "blob"
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clients_update_from_excel.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setImportMsg(getUserFacingError(e, "Не удалось скачать шаблон (права или сеть)."));
    }
  };

  const startImportFromLaunch = (file: File) => {
    if (file.size > CLIENT_IMPORT_MAX_FILE_BYTES) {
      const mb = Math.round(CLIENT_IMPORT_MAX_FILE_BYTES / (1024 * 1024));
      setImportMsg(
        `Файл больше ${mb} MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). Уменьшите размер или настройте MULTIPART_MAX_FILE_BYTES в .env на сервере.`
      );
      return;
    }
    setImportDialogMode(importLaunchMode);
    setImportStagingFile(file);
    setImportProgress(null);
    setImportLaunchOpen(false);
    setImportMapOpen(true);
  };

  return (
    <PageShell className="flex min-h-0 flex-1 flex-col gap-4 bg-transparent p-0 pb-0">
      <ClientImportLaunchDialog
        open={importLaunchOpen}
        onOpenChange={setImportLaunchOpen}
        mode={importLaunchMode}
        busy={importMut.isPending}
        onDownloadTemplate={() => downloadImportTemplate(importLaunchMode)}
        onConfirm={startImportFromLaunch}
      />
      <ClientImportMappingDialog
        open={importMapOpen}
        onOpenChange={(next) => {
          setImportMapOpen(next);
          if (!next) {
            setImportStagingFile(null);
            setImportProgress(null);
          }
        }}
        file={importStagingFile}
        importMode={importDialogMode}
        isSubmitting={importMut.isPending}
        progress={importProgress}
        onConfirm={(mappingPayload) => {
          if (!importStagingFile || !tenantSlug) return;
          setImportMsg(null);
          setImportProgress({
            stage: "queued",
            percent: 0,
            processedRows: 0,
            totalRows: 0
          });
          importMut.mutate({ file: importStagingFile, importMode: importDialogMode, ...mappingPayload });
        }}
      />
      {importMsg ? (
        <p className="mx-4 mt-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-gray-600 sm:mx-6">
          {importMsg}
        </p>
      ) : null}

      <div className="shrink-0 px-4 sm:px-6">
      <ClientsTemplateFiltersPanel
        draft={draftToolbar}
        onDraftChange={onToolbarDraftChange}
        onApply={handleApplyToolbarFilters}
        onReset={handleResetToolbarFilters}
        onDateRangeApplied={handleDateRangeApplied}
        categorySelectOptions={categorySelectOptions}
        clientTypeSelectOptions={clientTypeSelectOptions}
        clientFormatSelectOptions={clientFormatSelectOptions}
        salesChannelSelectOptions={salesChannelSelectOptions}
        equipmentSelectOptions={equipmentSelectOptions}
        territoryCascade={territoryCascade}
        agentOptions={agentsFilterQ.data ?? []}
        expeditorOptions={filteredExpeditorOptions}
        supervisorOptions={supervisorsFilterQ.data ?? []}
      />
      </div>

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Управление столбцами"
        description="Видимые столбцы и порядок. Сохраняется для вашей учётной записи (сервер)."
        columns={CLIENT_MANAGEABLE_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      {!authHydrated ? (
        showSessionLoadingHint ? (
          <div className="mx-6 max-w-xl rounded-md border border-rose-200/60 bg-rose-50/60 px-3 py-2 text-sm text-rose-700">
            Sessiya yuklanishi biroz cho&apos;zildi. Internet va login holatini tekshirib ko&apos;ring.
          </div>
        ) : (
          <p className="px-4 text-sm text-gray-600 sm:px-6">Загрузка сессии…</p>
        )
      ) : !tenantSlug ? (
        <p className="px-4 text-sm text-red-600 sm:px-6">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : isLoading && !data ? (
        <p className="px-4 text-sm text-gray-600 sm:px-6">Загрузка…</p>
      ) : isError ? (
        <div className="px-4 sm:px-6">
          <QueryErrorState message={getUserFacingError(error, "Не удалось загрузить клиентов.")} onRetry={() => void refetch()} />
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            isFetching && isPlaceholderData && "opacity-70 transition-opacity"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
          <ClientsTemplateListToolbar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            pageLimit={tablePrefs.pageSize}
            onPageLimitChange={(v) => {
              tablePrefs.setPageSize(v);
              setPage(1);
            }}
            onOpenColumnSettings={() => setColumnDialogOpen(true)}
            onRefresh={() => void refetch()}
            refreshing={isFetching}
            onResetView={() => {
              setSearch("");
              setPage(1);
            }}
            onImportUpdate={() => openImportLaunch("update")}
            onImportCreate={() => openImportLaunch("create")}
            importDisabled={importMut.isPending || !tenantSlug}
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="scrollbar-none relative min-h-0 flex-1 overflow-auto overscroll-contain">
            <ClientsDataTable
              rows={rows}
              visibility={getDefaultColumnVisibility()}
              orderedVisibleColumnIds={visibleColumnOrder}
              refDisplayMaps={refDisplayMaps}
              sortField={sortField}
              sortOrder={sortOrder}
              onSortByColumn={handleSortByColumn}
              bulkSelect
              selectedIds={selectedIds}
              onToggleRow={(id, selected) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (selected) next.add(id);
                  else next.delete(id);
                  return next;
                });
              }}
              onTogglePage={(selectAll) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (selectAll) {
                    for (const r of rows) next.add(r.id);
                  } else {
                    for (const r of rows) next.delete(r.id);
                  }
                  return next;
                });
              }}
              onEdit={(row) => {
                router.push(`/clients/${row.id}/edit`);
              }}
            />
            </div>
            {data ? (
              <ClientsListPagination
                page={page}
                totalPages={clientsTotalPages}
                total={data.total}
                pageSize={tablePrefs.pageSize}
                onPageChange={setPage}
              />
            ) : null}
          </div>
          </div>
        </div>
      )}

    </PageShell>
  );
}
