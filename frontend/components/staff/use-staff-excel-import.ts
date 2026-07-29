"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { StaffImportResultPayload } from "@/components/staff/staff-import-dialog";

export type StaffImportApiKind =
  | "agent"
  | "expeditor"
  | "supervisor"
  | "collector"
  | "auditor"
  | "skladchik"
  | "operator";

const ROUTE_BASE: Record<StaffImportApiKind, string> = {
  agent: "agents",
  expeditor: "expeditors",
  supervisor: "supervisors",
  collector: "collectors",
  auditor: "auditors",
  skladchik: "skladchik",
  operator: "operators"
};

const DIALOG_TITLE: Record<StaffImportApiKind, string> = {
  agent: "Импорт агентов из Excel",
  expeditor: "Импорт экспедиторов из Excel",
  supervisor: "Импорт супервайзеров из Excel",
  collector: "Импорт инкассаторов из Excel",
  auditor: "Импорт аудиторов из Excel",
  skladchik: "Импорт складчиков из Excel",
  operator: "Импорт сотрудников из Excel"
};

export function useStaffExcelImport(tenantSlug: string, kind: StaffImportApiKind) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StaffImportResultPayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const base = ROUTE_BASE[kind];

  const downloadTemplate = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await api.get(`/api/${tenantSlug}/${base}/import/template`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `staff_${kind}_import_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Не удалось скачать шаблон Excel");
    }
  }, [tenantSlug, base, kind]);

  const runImport = useCallback(
    async (file: File) => {
      if (!tenantSlug) return;
      setBusy(true);
      setResult(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post<{ data: StaffImportResultPayload }>(
          `/api/${tenantSlug}/${base}/import.xlsx`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        const r = data.data;
        setResult(r);
        setToast(
          `Импорт: +${r.created} создано, ${r.updated} обновлено` +
            (r.errors.length ? `, ${r.errors.length} ошибок` : "")
        );
      } catch {
        setToast("Ошибка импорта Excel");
      } finally {
        setBusy(false);
      }
    },
    [tenantSlug, base]
  );

  return {
    open,
    setOpen,
    busy,
    result,
    clearResult: () => setResult(null),
    toast,
    clearToast: () => setToast(null),
    dialogTitle: DIALOG_TITLE[kind],
    downloadTemplate,
    runImport
  };
}
