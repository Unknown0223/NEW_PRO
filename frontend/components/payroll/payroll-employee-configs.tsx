"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/lib/use-permissions";
import { apiFetch, useTenant } from "@/lib/api-client";
import { money, payrollApi, roleLabel } from "@/lib/payroll/payroll-api";
import { cellNumber, cellText, pickCell } from "@/lib/payroll/payroll-xlsx";
import { EmptyRow, NATIVE_SELECT, selectCls, parseAmount, Toolbar, useNotice } from "@/components/payroll/payroll-ui";
import { PayrollExcelImportDialog } from "@/components/payroll/payroll-excel-import-dialog";

type EmployeeConfig = {
  user_id: number;
  fio: string;
  code: string | null;
  role: string;
  branch: string | null;
  is_active: boolean;
  role_base_amount: number;
  base_amount: number | null;
  effective_base_amount: number;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  comment: string | null;
};

type Draft = { base: string; desk: string };
type ImportRow = { code: string; base_amount: number | null; cash_desk: string | null };
type ImportPreview = { row: number; code: string; fio: string | null; base_amount: number | null; status: string };

export function PayrollEmployeeConfigs() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.isAdmin || perms.has("staff.zarplaty.update");
  const notice = useNotice();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [inactive, setInactive] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [importOpen, setImportOpen] = useState(false);

  const listQ = useQuery({
    queryKey: ["payroll-employee-configs", tenant, inactive],
    enabled: Boolean(tenant),
    queryFn: () => api.get<EmployeeConfig[]>(`/employee-configs${inactive ? "?include_inactive=1" : ""}`)
  });
  const desksQ = useQuery({
    queryKey: ["cash-desks-min", tenant],
    enabled: Boolean(tenant),
    queryFn: () => apiFetch<{ data: Array<{ id: number; name: string; is_active: boolean }> }>(`/api/${tenant}/cash-desks`).then((r) => r.data)
  });

  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const r of listQ.data ?? []) next[r.user_id] = { base: r.base_amount != null ? String(r.base_amount) : "", desk: r.cash_desk_id ? String(r.cash_desk_id) : "" };
    setDrafts(next);
  }, [listQ.data]);

  const roles = useMemo(() => [...new Set((listQ.data ?? []).map((r) => r.role))].sort(), [listQ.data]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (listQ.data ?? []).filter((r) => (!role || r.role === role) && (!s || `${r.fio} ${r.code ?? ""}`.toLowerCase().includes(s)));
  }, [listQ.data, q, role]);

  const save = useMutation({
    mutationFn: (userId: number) => {
      const d = drafts[userId]!;
      return api.send("PUT", `/employee-configs/${userId}`, {
        base_amount: d.base.trim() === "" ? null : parseAmount(d.base),
        cash_desk_id: d.desk ? Number(d.desk) : null
      });
    },
    onSuccess: () => {
      notice.ok("Сохранено. Зарплата сотрудника пересчитается автоматически.");
      void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
    },
    onError: notice.fail
  });

  return (
    <div className="grid gap-3">
      {notice.element}
      <Toolbar>
        <Input placeholder="Поиск: ФИО или код" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-64" />
        <select className={selectCls("w-44")} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Все роли</option>
          {roles.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} /> Показать уволенных
        </label>
        <div className="flex-1" />
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="mr-1 size-4" /> Импорт Excel
          </Button>
        ) : null}
      </Toolbar>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Филиал</TableHead>
              <TableHead className="text-right">Оклад роли</TableHead>
              <TableHead className="w-44">Индивидуальный оклад</TableHead>
              <TableHead className="text-right">Итоговый</TableHead>
              <TableHead className="w-48">Касса выдачи</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? <EmptyRow colSpan={8} text="Загрузка…" /> : rows.length === 0 ? <EmptyRow colSpan={8} /> : null}
            {rows.map((r) => {
              const d = drafts[r.user_id];
              if (!d) return null;
              const dirty = d.base !== (r.base_amount != null ? String(r.base_amount) : "") || d.desk !== (r.cash_desk_id ? String(r.cash_desk_id) : "");
              return (
                <TableRow key={r.user_id} className={r.is_active ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{r.fio}</div>
                    <div className="text-xs text-muted-foreground">{r.code ?? "—"}{r.is_active ? "" : " · уволен"}</div>
                  </TableCell>
                  <TableCell>{roleLabel(r.role)}</TableCell>
                  <TableCell>{r.branch ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.role_base_amount)}</TableCell>
                  <TableCell>
                    <GroupedNumberInput value={d.base} placeholder="как у роли" disabled={!canEdit} onValueChange={(v) => setDrafts((s) => ({ ...s, [r.user_id]: { ...d, base: v } }))} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(r.effective_base_amount)}</TableCell>
                  <TableCell>
                    <select className={NATIVE_SELECT} value={d.desk} disabled={!canEdit} onChange={(e) => setDrafts((s) => ({ ...s, [r.user_id]: { ...d, desk: e.target.value } }))}>
                      <option value="">— по филиалу —</option>
                      {(desksQ.data ?? []).filter((k) => k.is_active).map((k) => (
                        <option key={k.id} value={k.id}>{k.name}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Button size="icon" variant={dirty ? "default" : "ghost"} disabled={!dirty || save.isPending} onClick={() => save.mutate(r.user_id)} aria-label="Сохранить">
                        <Save className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PayrollExcelImportDialog<ImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Импорт окладов из Excel"
        hint="Сотрудник ищется по коду. Пустой оклад — не меняется. Касса — название или код кассы."
        templateHeader={["Код", "Оклад", "Касса"]}
        templateFile="oklady-shablon.xlsx"
        mapRows={(raw) => {
          const out = raw
            .map((r) => ({
              code: cellText(pickCell(r, ["Код", "Code", "Kod"])),
              base_amount: cellNumber(pickCell(r, ["Оклад", "Base", "Oklad", "Сумма"])),
              cash_desk: cellText(pickCell(r, ["Касса", "Kassa", "Cash desk"])) || null
            }))
            .filter((r) => r.code);
          return out.length ? out : "В файле нет строк с колонкой «Код»";
        }}
        preview={async (rows, apply) => {
          const res = await api.send<{ preview: ImportPreview[]; applied: number }>("POST", "/employee-configs/import", { rows, apply });
          return { rows: res.preview.map((p) => ({ row: p.row, code: p.code, fio: p.fio, amount: p.base_amount, status: p.status })), applied: res.applied };
        }}
        statusLabels={{ ok: "OK", not_found: "Сотрудник не найден", bad_cash_desk: "Касса не найдена", bad_amount: "Неверная сумма" }}
        onApplied={(n) => {
          notice.ok(`Загружено: ${n}`);
          void qc.invalidateQueries({ queryKey: ["payroll-employee-configs", tenant] });
        }}
      />
    </div>
  );
}
