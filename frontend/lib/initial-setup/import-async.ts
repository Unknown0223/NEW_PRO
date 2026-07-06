import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";

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

function formatImportResult(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === "errors" && Array.isArray(v) && v.length) {
      parts.push(`Ошибки: ${v.slice(0, 3).join("; ")}`);
    } else if (typeof v === "number") {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.length ? parts.join(" · ") : "Импорт выполнен";
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
  const maxAttempts = 8000;
  const pollDelayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollDelayMs));
    const { data: job } = await api.get<BackgroundJobStatus>(`/api/${tenantSlug}/jobs/${jobId}`);

    if (job.progress?.message) {
      callbacks?.onProgress?.(job.progress.message);
    } else if (job.state === "active") {
      callbacks?.onProgress?.("Обработка данных…");
    }

    if (job.state === "waiting" && job.workersConnected === 0 && attempt >= 8) {
      throw new Error("Фоновый worker недоступен — импорт не может выполниться.");
    }

    if (job.state === "completed") {
      const result = job.returnvalue;
      if (result && typeof result === "object" && !Array.isArray(result)) {
        return formatImportResult(result as Record<string, unknown>);
      }
      return "Импорт выполнен";
    }

    if (job.state === "failed") {
      throw new Error(job.failedReason || "Импорт завершился с ошибкой");
    }
  }

  throw new Error("Превышено время ожидания импорта");
}

export async function runImportStep(
  tenantSlug: string,
  importPath: string,
  asyncPath: string | undefined,
  file: Blob,
  fileName: string,
  callbacks?: ImportAsyncCallbacks
): Promise<string> {
  if (asyncPath) {
    try {
      return await runAsyncImport(tenantSlug, asyncPath, file, fileName, callbacks);
    } catch (e) {
      const msg = getUserFacingError(e, "");
      if (msg && !msg.includes("404") && !msg.includes("Job")) throw e;
    }
  }

  const fd = new FormData();
  fd.append("file", file, fileName.endsWith(".xlsx") ? fileName : "import.xlsx");
  const { data } = await api.post<Record<string, unknown>>(`/api/${tenantSlug}${importPath}`, fd);
  return formatImportResult(data);
}
