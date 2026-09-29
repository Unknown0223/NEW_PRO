"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { usePermissions } from "@/lib/use-permissions";
import { useTenant } from "@/lib/api-client";
import { currentYm, fmtDateTime, money, payrollApi, ymLabel, ymQuery, type Ym } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, readXlsxRows } from "@/lib/payroll/payroll-xlsx";
import { cn } from "@/lib/utils";
import { MonthField, Toolbar, useNotice } from "@/components/payroll/payroll-ui";

type Cell = { column: string; excel: number; system: number | null; diff: number; reasons: string[] };
type Row = { code: string; fio: string | null; user_id: number | null; record_id: number | null; cells: Cell[]; diff_total: number };
type Report = {
  batch: { id: number; created_at: string; signed_off_at: string | null; sign_off_note: string | null } | null;
  rows: Row[];
  summary: { employees: number; matched: number; with_diff: number; not_found: number };
};
type InputRow = { code: string; name: string | null; columns: Record<string, number> };

const CODE_COLS = ["код", "код сотрудника", "kod", "code", "логин", "login"];
const NAME_COLS = ["фио", "сотрудник", "ф.и.о.", "fio", "имя"];
const SKIP_COLS = ["№", "n", "#", "роль", "филиал", "должность", "branch", "role"];
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function toInput(xs: Array<Record<string, unknown>>): InputRow[] | string {
  const out: InputRow[] = [];
  for (const x of xs) {
    let code = "";
    let name: string | null = null;
    const columns: Record<string, number> = {};
    for (const [k, v] of Object.entries(x)) {
      const key = norm(k);
      if (CODE_COLS.includes(key)) code = cellText(v);
      else if (NAME_COLS.includes(key)) name = cellText(v) || null;
      else if (!SKIP_COLS.includes(key) && !key.startsWith("__empty")) {
        const n = cellNumber(v);
        if (n != null) columns[k.trim()] = n;
      }
    }
    if (code && Object.keys(columns).length) out.push({ code, name, columns });
  }
  return out.length ? out : "Не найдены строки: нужна колонка «Код» и числовые колонки (Оклад, Начислено, названия надбавок…)";
}

export function PayrollCompareWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canImport = perms.isAdmin || perms.has("staff.zarplaty.import");
  const notice = useNotice();
  const [ym, setYm] = useState<Ym>(currentYm());
  const [onlyDiff, setOnlyDiff] = useState(true);

  const key = ["payroll-compare", tenant, ym.year, ym.month];
  const reportQ = useQuery({ queryKey: key, enabled: Boolean(tenant), queryFn: () => api.get<Report>(`/compare?${ymQuery(ym)}`) });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const rows = toInput(await readXlsxRows(file));
      if (typeof rows === "string") throw new Error(rows);
      return api.send<Report>("POST", "/compare", { ...ym, rows });
    },
    onSuccess: (r) => {
      qc.setQueryData(key, r);
      notice.ok(`Сверка готова: совпало ${r.summary.matched} из ${r.summary.employees}`);
    },
    onError: notice.fail
  });
  const signOff = useMutation({
    mutationFn: (p: { id: number; note: string | null }) => api.send("POST", `/compare/${p.id}/sign-off`, { note: p.note }),
    onSuccess: () => { notice.ok("Сверка подписана"); void qc.invalidateQueries({ queryKey: key }); },
    onError: notice.fail
  });

  const r = reportQ.data;
  const rows = (r?.rows ?? []).filter((x) => !onlyDiff || x.diff_total >= 0.01).sort((a, b) => b.diff_total - a.diff_total);

  return (
    <PageShell>
      <PageHeader
        title="Сверка с Excel (пробный месяц)"
        description="Загрузите ведомость, посчитанную по-старому. Система покажет расхождения по каждой колонке и причину: табель, формула, факт/возвраты, план, корректировки, ручные суммы."
      />
      {notice.element}
      <Toolbar>
        <MonthField value={ym} onChange={setYm} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Только расхождения
        </label>
        <div className="flex-1" />
        {r?.batch ? (
          r.batch.signed_off_at ? (
            <span className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> Подписано {fmtDateTime(r.batch.signed_off_at)}{r.batch.sign_off_note ? ` — ${r.batch.sign_off_note}` : ""}</span>
          ) : perms.isAdmin || perms.hasAny("staff.zarplaty.import", "staff.zarplaty.approve") ? (
            <Button
              size="sm"
              onClick={() => {
                const note = window.prompt(`Подписать сверку за ${ymLabel(ym)}? Комментарий (необязательно):`, "");
                if (note !== null) signOff.mutate({ id: r.batch!.id, note: note.trim() || null });
              }}
            >
              Подписать сверку
            </Button>
          ) : null
        ) : null}
      </Toolbar>
      {canImport ? <ExcelFileDropZone onFile={(f) => upload.mutate(f)} disabled={upload.isPending} /> : null}

      {r?.batch ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Сотрудников", value: r.summary.employees, cls: "" },
            { label: "Совпало", value: r.summary.matched, cls: "text-emerald-700" },
            { label: "С расхождением", value: r.summary.with_diff, cls: "text-amber-700" },
            { label: "Не найдено", value: r.summary.not_found, cls: "text-red-700" }
          ].map((x) => (
            <div key={x.label} className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">{x.label}</div>
              <div className={cn("text-2xl font-semibold", x.cls)}>{x.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{reportQ.isLoading ? "Загрузка…" : `За ${ymLabel(ym)} сверка ещё не загружалась.`}</p>
      )}

      {rows.map((row) => (
        <div key={row.code} className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <span className="font-medium">{row.fio ?? "—"}</span> <span className="text-xs text-muted-foreground">код {row.code}</span>
            </div>
            <span className={cn("text-sm tabular-nums", row.diff_total >= 0.01 ? "text-amber-700" : "text-emerald-700")}>
              {row.diff_total >= 0.01 ? `Расхождение ${money(row.diff_total, 2)}` : "Совпадает"}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1">Колонка</th>
                <th className="px-3 text-right">Excel</th>
                <th className="px-3 text-right">Система</th>
                <th className="px-3 text-right">Разница</th>
                <th className="px-3">Причина</th>
              </tr>
            </thead>
            <tbody>
              {row.cells.map((c) => (
                <tr key={c.column} className={cn("border-t", Math.abs(c.diff) >= 0.01 && "bg-amber-50/60")}>
                  <td className="px-3 py-1">{c.column}</td>
                  <td className="px-3 text-right tabular-nums">{money(c.excel, 2)}</td>
                  <td className="px-3 text-right tabular-nums">{money(c.system, 2)}</td>
                  <td className={cn("px-3 text-right tabular-nums", Math.abs(c.diff) >= 0.01 ? "font-medium text-amber-800" : "text-muted-foreground")}>{money(c.diff, 2)}</td>
                  <td className="px-3 text-xs text-muted-foreground">{c.reasons.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </PageShell>
  );
}
