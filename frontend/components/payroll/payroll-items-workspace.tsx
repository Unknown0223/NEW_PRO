"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { Can } from "@/components/access/can";
import { useTenant } from "@/lib/api-client";
import { payrollApi } from "@/lib/payroll/payroll-api";
import { EmptyRow, Field, NATIVE_SELECT, useNotice } from "@/components/payroll/payroll-ui";

export type PayrollItem = {
  id: number;
  name: string;
  code: string | null;
  type: "allowance" | "deduction";
  calc_type: "formula" | "manual" | "system";
  system_key: string | null;
  sort_order: number;
  color: string | null;
  comment: string | null;
  is_active: boolean;
};

type Draft = Omit<PayrollItem, "id" | "system_key"> & { id?: number };

const EMPTY: Draft = { name: "", code: null, type: "allowance", calc_type: "manual", sort_order: 100, color: null, comment: null, is_active: true };
const CALC_LABEL: Record<string, string> = { formula: "Формула", manual: "Вручную", system: "Системная" };

export function PayrollItemsWorkspace() {
  const tenant = useTenant();
  const api = payrollApi(tenant);
  const qc = useQueryClient();
  const notice = useNotice();
  const { confirm, dialog } = useAppConfirm();
  const [draft, setDraft] = useState<Draft | null>(null);

  const itemsQ = useQuery({
    queryKey: ["payroll-items", tenant],
    enabled: Boolean(tenant),
    queryFn: () => api.get<PayrollItem[]>("/items")
  });

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = { name: d.name.trim(), code: d.code?.trim() || null, type: d.type, calc_type: d.calc_type === "system" ? undefined : d.calc_type, sort_order: d.sort_order, color: d.color || null, comment: d.comment?.trim() || null, is_active: d.is_active };
      return d.id ? api.send("PATCH", `/items/${d.id}`, body) : api.send("POST", "/items", body);
    },
    onSuccess: () => {
      setDraft(null);
      notice.ok("Сохранено");
      void qc.invalidateQueries({ queryKey: ["payroll-items", tenant] });
    },
    onError: notice.fail
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.send("DELETE", `/items/${id}`),
    onSuccess: () => {
      notice.ok("Удалено");
      void qc.invalidateQueries({ queryKey: ["payroll-items", tenant] });
    },
    onError: notice.fail
  });

  const rows = itemsQ.data ?? [];
  return (
    <PageShell>
      <PageHeader
        title="Надбавки и вычеты"
        description="Статьи зарплатной ведомости. Системные статьи (Аванс, Корректировка, Qarzdorlik) заполняются автоматически."
        actions={
          <Can anyOf={["staff.zarplaty.create", "staff.zarplaty.update"]}>
            <Button size="sm" onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="mr-1 size-4" /> Добавить
            </Button>
          </Can>
        }
      />
      {notice.element}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Расчёт</TableHead>
              <TableHead>Код</TableHead>
              <TableHead className="text-right">Порядок</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsQ.isLoading ? <EmptyRow colSpan={8} text="Загрузка…" /> : rows.length === 0 ? <EmptyRow colSpan={8} /> : null}
            {rows.map((r) => (
              <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2">
                    {r.color ? <span className="size-3 rounded-full" style={{ backgroundColor: r.color }} /> : null}
                    {r.name}
                    {r.system_key ? <Lock className="size-3.5 text-muted-foreground" /> : null}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={r.type === "allowance" ? "text-emerald-700" : "text-red-700"}>
                    {r.type === "allowance" ? "Надбавка" : "Удержание"}
                  </span>
                </TableCell>
                <TableCell>{CALC_LABEL[r.calc_type] ?? r.calc_type}</TableCell>
                <TableCell className="text-muted-foreground">{r.code ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.sort_order}</TableCell>
                <TableCell>{r.is_active ? "Активна" : "Неактивна"}</TableCell>
                <TableCell className="max-w-64 truncate text-muted-foreground">{r.comment ?? ""}</TableCell>
                <TableCell className="text-right">
                  {r.system_key ? null : (
                    <div className="flex justify-end gap-1">
                      <Can permission="staff.zarplaty.update">
                        <Button size="icon" variant="ghost" onClick={() => setDraft({ ...r })} aria-label="Изменить">
                          <Pencil className="size-4" />
                        </Button>
                      </Can>
                      <Can permission="staff.zarplaty.delete">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Удалить"
                          onClick={async () => {
                            const ok = await confirm({ title: "Удалить статью", message: `Удалить «${r.name}»?`, confirmLabel: "Удалить", cancelLabel: "Отмена", destructive: true });
                            if (ok) remove.mutate(r.id);
                          }}
                        >
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </Can>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={draft != null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Изменить статью" : "Новая статья"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3">
              <Field label="Название">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Тип">
                  <select className={NATIVE_SELECT} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}>
                    <option value="allowance">Надбавка</option>
                    <option value="deduction">Удержание</option>
                  </select>
                </Field>
                <Field label="Расчёт">
                  <select className={NATIVE_SELECT} value={draft.calc_type} onChange={(e) => setDraft({ ...draft, calc_type: e.target.value as Draft["calc_type"] })}>
                    <option value="manual">Вручную</option>
                    <option value="formula">Формула</option>
                  </select>
                </Field>
                <Field label="Код">
                  <Input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
                </Field>
                <Field label="Порядок">
                  <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
                </Field>
                <Field label="Цвет">
                  <Input type="color" value={draft.color ?? "#64748b"} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-9 p-1" />
                </Field>
                <label className="flex items-center gap-2 pt-5 text-sm">
                  <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                  Активна
                </label>
              </div>
              <Field label="Комментарий">
                <Input value={draft.comment ?? ""} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDraft(null)}>Отмена</Button>
                <Button size="sm" disabled={!draft.name.trim() || save.isPending} onClick={() => save.mutate(draft)}>
                  Сохранить
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {dialog}
    </PageShell>
  );
}
