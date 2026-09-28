"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Pencil } from "lucide-react";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import {
  POSITION_CATALOG_ROLE_OPTIONS,
  positionCatalogRoleLabel
} from "@/lib/position-catalog-roles";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type WebStaffPositionPresetRow = {
  id: string;
  label: string;
  role: string | null;
  code: string | null;
  comment: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  created_by_user_id: number | null;
  created_by_label: string | null;
  deactivated_at: string | null;
  deactivated_by_user_id: number | null;
  deactivated_by_label: string | null;
  linked_operator_count: number;
};

type Props = { tenantSlug: string };
type PresetTab = "active" | "inactive";

type FormState = {
  label: string;
  role: string;
  code: string;
  sort_order: string;
  comment: string;
  is_active: boolean;
};

const emptyForm = (): FormState => ({
  label: "",
  role: "",
  code: "",
  sort_order: "",
  comment: "",
  is_active: true
});

function pickZodLeaf(per: Record<string, string>, leaf: string): string | undefined {
  for (const [k, v] of Object.entries(per)) {
    if (k === leaf || k.endsWith(`.${leaf}`)) return v;
  }
  return undefined;
}

function invalidateStaffQueries(qc: ReturnType<typeof useQueryClient>, tenantSlug: string) {
  void qc.invalidateQueries({ queryKey: ["operators", tenantSlug] });
  void qc.invalidateQueries({ queryKey: ["agents", tenantSlug] });
  void qc.invalidateQueries({ queryKey: ["expeditors", tenantSlug] });
  void qc.invalidateQueries({ queryKey: ["supervisors", tenantSlug] });
}

export function WebStaffPositionPresetsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<PresetTab>("active");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState("");

  const listQ = useQuery({
    queryKey: ["operators", tenantSlug, "position-presets-admin"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: WebStaffPositionPresetRow[] }>(
        `/api/${tenantSlug}/operators/meta/position-presets`
      );
      return data.data;
    }
  });

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);
  const activeRows = useMemo(() => rows.filter((r) => r.is_active), [rows]);
  const inactiveRows = useMemo(() => rows.filter((r) => !r.is_active), [rows]);
  const subset = useMemo(() => {
    const base = tab === "active" ? activeRows : inactiveRows;
    if (!roleFilter) return base;
    return base.filter((r) => r.role === roleFilter);
  }, [tab, activeRows, inactiveRows, roleFilter]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        label: form.label.trim(),
        role: form.role.trim() || null,
        code: form.code.trim() || null,
        comment: form.comment.trim() || null,
        sort_order: form.sort_order.trim() === "" ? null : Number(form.sort_order),
        is_active: form.is_active
      };
      if (editId) {
        const { data } = await api.patch<{ data: WebStaffPositionPresetRow }>(
          `/api/${tenantSlug}/operators/meta/position-presets/${editId}`,
          body
        );
        return data.data;
      }
      const { data } = await api.post<{ data: WebStaffPositionPresetRow }>(
        `/api/${tenantSlug}/operators/meta/position-presets`,
        body
      );
      return data.data;
    },
    onSuccess: async (row) => {
      setOpen(false);
      setEditId(null);
      setForm(emptyForm());
      setBanner(null);
      setTab(row.is_active ? "active" : "inactive");
      await listQ.refetch();
      invalidateStaffQueries(qc, tenantSlug);
    }
  });

  const toggleMut = useMutation({
    mutationFn: async (args: { id: string; is_active: boolean }) => {
      const { data } = await api.patch<{ data: WebStaffPositionPresetRow }>(
        `/api/${tenantSlug}/operators/meta/position-presets/${args.id}`,
        { is_active: args.is_active }
      );
      return data.data;
    },
    onSuccess: async (row) => {
      setBanner(null);
      setTab(row.is_active ? "active" : "inactive");
      await listQ.refetch();
      invalidateStaffQueries(qc, tenantSlug);
    }
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm());
    setMsg(null);
    setFieldErrs({});
    setOpen(true);
  }

  function openEdit(row: WebStaffPositionPresetRow) {
    setEditId(row.id);
    setForm({
      label: row.label,
      role: row.role ?? "",
      code: row.code ?? "",
      sort_order: row.sort_order != null ? String(row.sort_order) : "",
      comment: row.comment ?? "",
      is_active: row.is_active
    });
    setMsg(null);
    setFieldErrs({});
    setOpen(true);
  }

  function submit() {
    void (async () => {
      setMsg(null);
      setFieldErrs({});
      if (!form.label.trim()) {
        setFieldErrs({ label: "Название обязательно" });
        return;
      }
      if (!form.role.trim()) {
        setFieldErrs({ role: "Выберите роль" });
        return;
      }
      try {
        await saveMut.mutateAsync();
      } catch (e: unknown) {
        if (isAxiosError(e)) {
          const flat = getZodFlattenFromApiErrorBody(e.response?.data);
          if (flat) {
            const per = firstMessagePerField(flat);
            setFieldErrs(per);
            const hint = firstValidationUserHint(flat);
            setMsg(hint ? withApiSupportLine(hint, e) : getUserFacingError(e, "Ошибка при сохранении."));
            return;
          }
          const code = (e.response?.data as { error?: string } | undefined)?.error;
          if (code === "DuplicateLabel") {
            setMsg("Такое название уже существует.");
            return;
          }
          if (code === "BadRole") {
            setFieldErrs({ role: "Некорректная роль" });
            return;
          }
        }
        setMsg(getUserFacingError(e, "Ошибка при сохранении."));
      }
    })();
  }

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setFieldErrs({});
  }, [open]);

  const emptyMsg =
    tab === "active"
      ? "Активных должностей нет — добавьте кнопкой «Добавить»."
      : "Неактивных должностей нет.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Должности">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "active"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("active")}
          >
            Активный{activeRows.length ? ` (${activeRows.length})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "inactive"}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === "inactive"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("inactive")}
          >
            Не активный{inactiveRows.length ? ` (${inactiveRows.length})` : ""}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Фильтр по роли"
          >
            <option value="">Все роли</option>
            {POSITION_CATALOG_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={openCreate}>
            Добавить
          </Button>
        </div>
      </div>

      {banner ? <p className="text-sm text-destructive">{banner}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Изменить" : "Добавить"}</DialogTitle>
            <DialogDescription>
              Название должности сохраняется в карточке сотрудника; роль связана с системной ролью пользователя.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

            <div className="grid gap-1.5">
              <Label htmlFor="pos-role">Роль</Label>
              <select
                id="pos-role"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="">— Выберите —</option>
                {POSITION_CATALOG_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {pickZodLeaf(fieldErrs, "role") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(fieldErrs, "role")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pos-label">Названия</Label>
              <Input
                id="pos-label"
                value={form.label}
                maxLength={128}
                placeholder="Например: AGENT"
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
              {pickZodLeaf(fieldErrs, "label") ? (
                <p className="text-xs text-destructive">{pickZodLeaf(fieldErrs, "label")}</p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pos-code">Код</Label>
              <Input
                id="pos-code"
                value={form.code}
                maxLength={20}
                placeholder="0 / 20"
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.slice(0, 20) }))}
              />
              <p className="text-[11px] text-muted-foreground">{form.code.length} / 20</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pos-sort">Сортировка</Label>
              <Input
                id="pos-sort"
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pos-comment">Комментарий</Label>
              <Input
                id="pos-comment"
                value={form.comment}
                maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              Активный
            </label>
          </div>
          <DialogFooter className="border-0 bg-transparent p-0 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={saveMut.isPending} onClick={submit}>
              {saveMut.isPending ? "…" : editId ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="app-table-thead text-left text-xs">
              <tr>
                <th className="px-3 py-2.5">Названия</th>
                <th className="px-3 py-2.5">Должность</th>
                <th className="px-3 py-2.5">Сортировка</th>
                <th className="px-3 py-2.5">Код</th>
                <th className="px-3 py-2.5">Комментарий</th>
                <th className="px-3 py-2.5 text-center" title="Количество сотрудников">
                  Связь
                </th>
                <th className="w-24 px-2 py-2.5 text-center">Действия</th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Загрузка…
                  </td>
                </tr>
              ) : subset.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {emptyMsg}
                  </td>
                </tr>
              ) : (
                subset.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {positionCatalogRoleLabel(r.role)}
                    </td>
                    <td className="px-3 py-2">{r.sort_order ?? "—"}</td>
                    <td className="px-3 py-2">{r.code?.trim() || "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                      {r.comment?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">{r.linked_operator_count}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-8 text-amber-600"
                          title="Изменить"
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={toggleMut.isPending}
                          onClick={() =>
                            void toggleMut
                              .mutateAsync({ id: r.id, is_active: !r.is_active })
                              .catch((e) => setBanner(getUserFacingError(e, "Ошибка.")))
                          }
                        >
                          {r.is_active ? "Выкл" : "Вкл"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          Показано {subset.length ? 1 : 0} - {subset.length} / {subset.length}
        </div>
      </div>
    </div>
  );
}
