import { api } from "@/lib/api";
import {
  ImportFailedError,
  importResultSavedCount
} from "@/lib/initial-setup/import-result";
import { isAxiosError } from "axios";

type JobProgress = {
  stage?: string;
  percent?: number;
  processedRows?: number;
  totalRows?: number;
  message?: string;
};

type BackgroundJobStatus = {
  state: string;
  progress?: JobProgress | null;
  returnvalue?: unknown;
  failedReason?: string;
  workersConnected?: number;
};

export type ImportAsyncCallbacks = {
  onProgress?: (message: string) => void;
};

const IMPORT_RESULT_LABELS: Record<string, string> = {
  created: "создано",
  updated: "обновлено",
  imported: "импортировано",
  skipped_empty: "пустых строк",
  skipped_unknown_sku: "SKU не найдено",
  skipped_no_change: "без изменений"
};

function assertImportSucceeded(data: Record<string, unknown>): void {
  const errors = Array.isArray(data.errors)
    ? data.errors.map((e) => String(e).trim()).filter(Boolean)
    : [];
  const ok = importResultSavedCount(data);
  // Dublikat va boshqa qator xatolari — har doim foydalanuvchiga ko‘rsatiladi
  if (errors.length) {
    throw new ImportFailedError(errors, ok);
  }
  if (ok === 0) {
    throw new ImportFailedError(
      ["Нет строк для сохранения (проверьте категории, единицы и дубликаты)"],
      0
    );
  }
}

function formatImportResult(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === "errors") continue;
    if (typeof v === "number" && v > 0) {
      parts.push(`${IMPORT_RESULT_LABELS[k] ?? k}: ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : "Импорт выполнен";
}

async function runSyncImport(
  tenantSlug: string,
  importPath: string,
  file: Blob,
  fileName: string
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, fileName.endsWith(".xlsx") ? fileName : "import.xlsx");
  const { data } = await api.post<Record<string, unknown>>(`/api/${tenantSlug}${importPath}`, fd);
  assertImportSucceeded(data);
  return formatImportResult(data);
}

export async function runAsyncImport(
  tenantSlug: string,
  asyncPath: string,
  file: Blob,
  fileName: string,
  callbacks?: ImportAsyncCallbacks
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, fileName.endsWith(".xlsx") ? fileName : "import.xlsx");

  callbacks?.onProgress?.("Загрузка файла…");
  const { data: enqueueRes } = await api.post<{ jobId: string }>(`/api/${tenantSlug}${asyncPath}`, fd);
  const jobId = String(enqueueRes.jobId ?? "").trim();
  if (!jobId) throw new Error("Не получен ID задачи импорта");

  callbacks?.onProgress?.("Ожидание в очереди…");
  const maxAttempts = 120;
  const pollDelayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollDelayMs));
    const { data: job } = await api.get<BackgroundJobStatus>(`/api/${tenantSlug}/jobs/${jobId}`);

    if (job.progress?.message) {
      callbacks?.onProgress?.(job.progress.message);
    } else if (job.state === "active") {
      callbacks?.onProgress?.("Обработка данных…");
    }

    if (job.state === "waiting" && job.workersConnected === 0 && attempt >= 4) {
      throw new Error("Фоновый worker недоступен");
    }

    if (job.state === "completed") {
      const result = job.returnvalue;
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const payload = result as Record<string, unknown>;
        assertImportSucceeded(payload);
        return formatImportResult(payload);
      }
      throw new Error("Импорт не выполнен: пустой ответ задачи");
    }

    if (job.state === "failed") {
      throw new Error(job.failedReason || "Импорт завершился с ошибкой");
    }
  }

  throw new Error("Превышено время ожидания импорта");
}

/** Avvalo to‘g‘ridan-to‘g‘ri import (ishonchli); katta fayl/timeout bo‘lsa — async. */
export async function runImportStep(
  tenantSlug: string,
  importPath: string,
  asyncPath: string | undefined,
  file: Blob,
  fileName: string,
  callbacks?: ImportAsyncCallbacks
): Promise<string> {
  callbacks?.onProgress?.("Импорт на сервер…");
  try {
    return await runSyncImport(tenantSlug, importPath, file, fileName);
  } catch (syncErr) {
    // Dublikat/validatsiya — asyncga o‘tmasin
    if (syncErr instanceof ImportFailedError) throw syncErr;
    if (!asyncPath) throw syncErr;
    if (isAxiosError(syncErr)) {
      const status = syncErr.response?.status;
      if (status === 400 || status === 422) throw syncErr;
      if (status !== 408 && status !== 413 && status !== 503 && status !== 504) {
        const body = syncErr.response?.data;
        if (body && typeof body === "object" && !Array.isArray(body)) {
          const saved = importResultSavedCount(body as Record<string, unknown>);
          if (saved === 0) throw syncErr;
        }
      }
    }
    callbacks?.onProgress?.("Повтор через очередь…");
    try {
      return await runAsyncImport(tenantSlug, asyncPath, file, fileName, callbacks);
    } catch {
      throw syncErr;
    }
  }
}
