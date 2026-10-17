"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { useTenant } from "@/lib/api-client";
import { PayrollModal, PayrollModalActions } from "@/components/payroll/kit/payroll-kit-modal";
import { cn } from "@/lib/utils";

type Person = {
  user_id: number;
  first_name: string;
  last_name: string;
  code: string | null;
  role: string;
  branch: string | null;
  trade_direction: string | null;
  kpi_ids: number[];
  amounts: Record<string, number>;
};
type Grid = { groups: Array<{ id: number; name: string }>; people: Person[] };
type PreviewRow = { fio: string; code: string; branch: string; role: string; amounts: Record<string, number | null> };
type SortKey = "fio" | "branch" | "role" | "code";

const RED = "FFFAD4D4";
const HEAD_BG = "FF0D3B66";
const HEAD = ["Имя", "Фамилия", "Филиал", "Смарт-код", "Роль"];

function sheetName(role: string) {
  return roleLabel(role).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Роль";
}

function byPlace(a: Person, b: Person) {
  return (a.branch ?? "").localeCompare(b.branch ?? "", "ru")
    || roleLabel(a.role).localeCompare(roleLabel(b.role), "ru")
    || (a.last_name || "").localeCompare(b.last_name || "", "ru")
    || (a.first_name || "").localeCompare(b.first_name || "", "ru");
}

function blockedFill(argb: string | undefined) {
  const c = (argb ?? "").toUpperCase();
  return c.endsWith("FAD4D4") || c.endsWith("FF0000");
}

export function PayrollKpiGridTemplate({
  open,
  year,
  month,
  roles,
  filter,
  onClose,
  onDone,
  onFail
}: {
  open: boolean;
  year: number;
  month: number;
  roles: Array<{ role: string }>;
  filter?: { role: string; branch: string; direction: string };
  onClose: () => void;
  onDone: (text: string) => void;
  onFail: (e: unknown) => void;
}) {
  const tenant = useTenant();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; cols: string[]; skipped: number; saved: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("branch");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const all = useMemo(() => {
    const list = roles.map((r) => r.role);
    return filter?.role ? list.filter((r) => r === filter.role) : list;
  }, [roles, filter?.role]);
  const shown = useMemo(() => {
    if (!preview) return [];
    const order: SortKey[] = sortKey === "role" ? ["role", "branch", "fio"] : sortKey === "branch" ? ["branch", "role", "fio"] : [sortKey, "branch", "role"];
    return [...preview.rows].sort((a, b) => {
      for (const key of order) {
        const cmp = a[key].localeCompare(b[key], "ru");
        if (cmp) return cmp * sortDir;
      }
      return 0;
    });
  }, [preview, sortKey, sortDir]);

  useEffect(() => {
    if (open && filter?.role) setPicked([filter.role]);
  }, [open, filter?.role]);
  const toggle = (role: string) => setPicked((cur) => (cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]));
  const sortBy = (key: SortKey) => {
    setSortDir((dir) => (sortKey === key ? (dir === 1 ? -1 : 1) : 1));
    setSortKey(key);
  };

  const download = async () => {
    setBusy(true);
    try {
      const data = await payrollApi(tenant).get<Grid>(`/kpi-grid?year=${year}&month=${month}`);
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      for (const role of picked) {
        const people = data.people.filter((p) => p.role === role && (!filter?.branch || p.branch === filter.branch) && (!filter?.direction || p.trade_direction === filter.direction)).sort(byPlace);
        if (!people.length) continue;
        const ids = new Set(people.flatMap((p) => p.kpi_ids));
        const cols = data.groups.filter((g) => ids.has(g.id));
        const titles = [...HEAD, ...cols.map((c) => c.name)];
        const ws = wb.addWorksheet(sheetName(role), { views: [{ state: "frozen", xSplit: HEAD.length, ySplit: 1 }] });
        const head = ws.addRow(titles);
        head.height = 22;
        head.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_BG } };
          cell.alignment = { vertical: "middle", wrapText: true };
        });
        for (const p of people) {
          const row = ws.addRow([p.first_name, p.last_name, p.branch ?? "", p.code ?? "", roleLabel(p.role), ...cols.map(() => "")]);
          cols.forEach((c, i) => {
            const cell = row.getCell(HEAD.length + 1 + i);
            if (!p.kpi_ids.includes(c.id)) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED } };
              cell.value = null;
            } else if (p.amounts[String(c.id)] != null) cell.value = p.amounts[String(c.id)];
          });
        }
        ws.columns = titles.map((h) => ({ width: Math.max(14, Math.min(28, h.length + 2)) }));
      }
      if (!wb.worksheets.length) {
        onFail("По выбранному фильтру нет сотрудников");
        return;
      }
      const buf = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buf]));
      a.download = `setka-${year}-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      onDone("Шаблон скачан");
      onClose();
    } catch (e) {
      onFail(e);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const data = await payrollApi(tenant).get<Grid>(`/kpi-grid?year=${year}&month=${month}`);
      const byCode = new Map(data.people.filter((p) => p.code).map((p) => [p.code!, p]));
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const rows: Array<{ user_id: number; amounts: Record<string, number | null> }> = [];
      const previewRows: PreviewRow[] = [];
      const colNames = new Set<string>();
      let skipped = 0;
      for (const ws of wb.worksheets) {
        const head = ws.getRow(1).values as unknown[];
        const names = head.map((v) => (v == null ? "" : String(v).trim()));
        const codeCol = names.findIndex((n) => n === "Смарт-код");
        if (codeCol < 0) continue;
        ws.eachRow((row, n) => {
          if (n === 1) return;
          const code = String(row.getCell(codeCol).value ?? "").trim();
          const person = byCode.get(code);
          if (!person) return;
          const amounts: Record<string, number | null> = {};
          const named: Record<string, number | null> = {};
          data.groups.forEach((g) => {
            const col = names.findIndex((h) => h === g.name);
            if (col < 0) return;
            const cell = row.getCell(col);
            const argb = cell.fill && cell.fill.type === "pattern" ? cell.fill.fgColor?.argb : "";
            const raw = cell.value;
            const num = typeof raw === "number" ? raw : raw == null || raw === "" ? null : Number(String(raw).replace(/\s/g, "").replace(",", "."));
            const hasNum = num != null && !Number.isNaN(num);
            if (!person.kpi_ids.includes(g.id) || blockedFill(argb)) {
              if (hasNum) skipped += 1;
              return;
            }
            amounts[String(g.id)] = hasNum ? num : null;
            named[g.name] = amounts[String(g.id)] ?? null;
            colNames.add(g.name);
          });
          if (!Object.keys(amounts).length) return;
          rows.push({ user_id: person.user_id, amounts });
          previewRows.push({
            fio: `${person.last_name} ${person.first_name}`.trim(),
            code: person.code ?? "",
            branch: person.branch ?? "",
            role: roleLabel(person.role),
            amounts: named
          });
        });
      }
      const res = rows.length
        ? await payrollApi(tenant).send<{ saved: number }>("PUT", "/kpi-grid", { year, month, rows })
        : { saved: 0 };
      void qc.invalidateQueries({ queryKey: ["payroll-kpi-grid", tenant] });
      void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
      setSortKey("branch");
      setSortDir(1);
      setPreview({ rows: previewRows, cols: [...colNames], skipped, saved: res.saved });
      onDone(skipped ? `Импорт: обновлено ${res.saved}. Светло-красные ячейки пропущены: ${skipped}` : `Импорт: обновлено ${res.saved}`);
      onClose();
    } catch (e) {
      onFail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PayrollModal open={open} onClose={onClose} title="Шаблон окладной сетки" width="sm:max-w-md">
        <p className="text-[13px] text-muted-foreground">
          Шаблон только по текущему фильтру{filter?.branch ? `: филиал «${filter.branch}»` : ""}{filter?.direction ? `, направление «${filter.direction}»` : ""}{filter?.role ? `, роль «${roleLabel(filter.role)}»` : ""}. Светло-красная ячейка при импорте не принимается.
        </p>
        <div className="mt-3 grid max-h-64 gap-1 overflow-auto">
          {all.map((role) => (
            <label key={role} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted">
              <input type="checkbox" className="accent-primary" checked={picked.includes(role)} onChange={() => toggle(role)} />
              {roleLabel(role)}
            </label>
          ))}
        </div>
        <PayrollModalActions
          onCancel={onClose}
          cancelLabel="Отмена"
          onSubmit={() => void download()}
          submitLabel="Скачать"
          busy={busy}
          disabled={!picked.length}
          left={
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importFile(f);
                }}
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[var(--pr-input)] bg-card px-4 text-[13.5px] font-medium text-foreground/80 shadow-sm hover:bg-muted">
                Импорт
              </span>
            </label>
          }
        />
      </PayrollModal>
      <PayrollModal open={preview != null} onClose={() => setPreview(null)} title="Принятые значения" width="sm:max-w-5xl">
        <p className="mb-3 text-[13px] text-muted-foreground">
          Обновлено: {preview?.saved ?? 0}. Светло-красные ячейки не приняты: {preview?.skipped ?? 0}. Сортировка по умолчанию — филиал, затем роль.
        </p>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr>
                {([["fio", "ФИО"], ["branch", "Филиал"], ["role", "Роль"], ["code", "Смарт-код"]] as Array<[SortKey, string]>).map(([key, label]) => (
                  <th key={key} className="sticky top-0 bg-[#0d3b66] px-2 py-2 text-left text-white">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => sortBy(key)}>
                      {label}
                      {sortKey === key ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                {(preview?.cols ?? []).map((name) => (
                  <th key={name} className="sticky top-0 bg-[#0d3b66] px-2 py-2 text-right text-white">{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.code}-${r.fio}`} className="border-t border-[var(--pr-line)]">
                  <td className="px-2 py-1.5">{r.fio}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.branch || "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.role}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.code || "—"}</td>
                  {(preview?.cols ?? []).map((name) => (
                    <td key={name} className={cn("px-2 py-1.5 text-right tabular-nums", r.amounts[name] == null && "text-muted-foreground/50")}>
                      {r.amounts[name] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PayrollModal>
    </>
  );
}
