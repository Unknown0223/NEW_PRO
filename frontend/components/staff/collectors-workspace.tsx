"use client";

import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MonitorSmartphone, Pencil, RefreshCw, UserMinus } from "lucide-react";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
type CollectorRow = {
  id: number;
  fio: string;
  login: string;
  phone: string | null;
  code: string | null;
  pinfl: string | null;
  branch: string | null;
  position: string | null;
  apk_version: string | null;
  app_access: boolean;
  territory: string | null;
  device_name: string | null;
  active_session_count: number;
  max_sessions: number;
  cash_desks?: Array<{ id: number; name: string }>;
  is_active: boolean;
};

type Props = { tenantSlug: string };

export function CollectorsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [draftPos, setDraftPos] = useState("");
  const [draftTerritory, setDraftTerritory] = useState("");
  const [appliedPos, setAppliedPos] = useState("");
  const [appliedTerritory, setAppliedTerritory] = useState("");
  const [editRow, setEditRow] = useState<CollectorRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sessionRow, setSessionRow] = useState<CollectorRow | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<CollectorRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const filterQ = useQuery({
    queryKey: ["collectors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { positions: string[]; territories: string[] } }>(
        `/api/${tenantSlug}/collectors/filter-options`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["collectors", tenantSlug, tab, appliedPos, appliedTerritory],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("is_active", tab === "active" ? "true" : "false");
      if (appliedPos.trim()) p.set("position", appliedPos.trim());
      if (appliedTerritory.trim()) p.set("territory", appliedTerritory.trim());
      const { data } = await api.get<{ data: CollectorRow[] }>(`/api/${tenantSlug}/collectors?${p.toString()}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<CollectorRow>(`/api/${tenantSlug}/collectors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["collectors-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<CollectorRow>(`/api/${tenantSlug}/collectors`, body);
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["collectors-filter-options", tenantSlug] });
    },
    onError: (e: unknown) => {
      const ax = e as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const hint = firstValidationUserHint(flat);
        setCreateError(withApiSupportLine(hint ?? "Ma’lumotlarni tekshiring.", e));
        return;
      }
      setCreateError(messageFromStaffCreateError(e));
    }
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/api/${tenantSlug}/collectors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      setDeactivateRow(null);
      void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] });
    }
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src = listQ.data ?? [];
    if (!q) return src;
    return src.filter((r) =>
      [
        r.fio,
        r.login,
        r.phone ?? "",
        r.code ?? "",
        r.pinfl ?? "",
        r.branch ?? "",
        r.position ?? "",
        r.device_name ?? "",
        r.territory ?? "",
        ...(r.cash_desks ?? []).map((c) => c.name)
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [listQ.data, search]);

  return (
    <div className="space-y-0">
      <Card className="rounded-none border-0 bg-transparent shadow-none">
        <CardContent className="space-y-0 p-0">
          <div className="flex flex-wrap items-end gap-3 border-b border-border/80 bg-muted/30 px-4 py-3">
            <FilterSelect emptyLabel="Должность" value={draftPos} onChange={(e) => setDraftPos(e.target.value)}>
              {(filterQ.data?.positions ?? []).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect emptyLabel="Территория" value={draftTerritory} onChange={(e) => setDraftTerritory(e.target.value)}>
              {(filterQ.data?.territories ?? []).map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FilterSelect>
            <Input className="h-9 max-w-xs bg-background text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button
              type="button"
              size="sm"
              className="h-9 bg-teal-700 text-white hover:bg-teal-800"
              onClick={() => {
                setAppliedPos(draftPos);
                setAppliedTerritory(draftTerritory);
              }}
            >
              Применить
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" className="h-9 w-9" onClick={() => void listQ.refetch()}>
              <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            </Button>
            <Button type="button" size="sm" className="ml-auto h-9" onClick={() => setAddOpen(true)}>
              Добавить
            </Button>
          </div>

          <div className="flex border-b border-border/80 px-4">
            <button
              type="button"
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === "active" ? "border-primary text-primary" : "border-transparent")}
              onClick={() => setTab("active")}
            >
              Активный
            </button>
            <button
              type="button"
              className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === "inactive" ? "border-primary text-primary" : "border-transparent")}
              onClick={() => setTab("inactive")}
            >
              Не активный
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead className="app-table-thead">
                <tr>
                  <th className="px-2 py-2 text-left">Ф.И.О</th>
                  <th className="px-2 py-2 text-left">Кассы</th>
                  <th className="px-2 py-2 text-left">Территории</th>
                  <th className="px-2 py-2 text-left">Телефон</th>
                  <th className="px-2 py-2 text-left">Код</th>
                  <th className="px-2 py-2 text-left">Название устройства</th>
                  <th className="px-2 py-2 text-left">ПИНФЛ</th>
                  <th className="px-2 py-2 text-left">Филиал</th>
                  <th className="px-2 py-2 text-left">Должность</th>
                  <th className="px-2 py-2 text-left">Версия APK</th>
                  <th className="px-2 py-2 text-left">Доступ к прилож.</th>
                  <th className="px-2 py-2 text-left">Активные сессии</th>
                  <th className="px-2 py-2 text-left">Макс. сессии</th>
                  <th className="px-2 py-2 text-left">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t even:bg-muted/20">
                    <td className="px-2 py-2">{r.fio}</td>
                    <td className="px-2 py-2">
                      <div className="flex max-w-[14rem] flex-wrap gap-1">
                        {(r.cash_desks ?? []).length ? (r.cash_desks ?? []).map((x) => (
                          <span key={x.id} className="rounded bg-muted px-1.5 py-0.5">{x.name}</span>
                        )) : "—"}
                      </div>
                    </td>
                    <td className="px-2 py-2">{r.territory ?? "—"}</td>
                    <td className="px-2 py-2">{r.phone ?? "—"}</td>
                    <td className="px-2 py-2">{r.code ?? "—"}</td>
                    <td className="px-2 py-2">{r.device_name ?? "—"}</td>
                    <td className="px-2 py-2">{r.pinfl ?? "—"}</td>
                    <td className="px-2 py-2">{r.branch ?? "—"}</td>
                    <td className="px-2 py-2">{r.position ?? "—"}</td>
                    <td className="px-2 py-2">{r.apk_version ?? "—"}</td>
                    <td className="px-2 py-2">
                      <input type="checkbox" className="size-4 accent-primary" checked={r.app_access} onChange={(e) => patchMut.mutate({ id: r.id, body: { app_access: e.target.checked } })} />
                    </td>
                    <td className="px-2 py-2">
                      <button type="button" className="text-primary hover:underline" onClick={() => setSessionRow(r)}>
                        {r.active_session_count}
                      </button>
                    </td>
                    <td className="px-2 py-2">{r.max_sessions}</td>
                    <td className="px-2 py-2 text-right">
                      <TableRowActionGroup className="justify-end" ariaLabel="Collector">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSessionRow(r)}>
                          <MonitorSmartphone className="size-3.5" />
                        </Button>
                        <Button type="button" variant="outline" size="icon-sm" onClick={() => setEditRow(r)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        {tab === "active" ? (
                          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeactivateRow(r)}>
                            <UserMinus className="size-3.5" />
                          </Button>
                        ) : null}
                      </TableRowActionGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <CollectorEditDialog row={editRow} onClose={() => setEditRow(null)} onPatch={(id, body) => patchMut.mutateAsync({ id, body })} />
      <CollectorAddDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setCreateError(null);
        }}
        loading={createMut.isPending}
        submitError={createError}
        onSubmit={(body) => {
          setCreateError(null);
          createMut.mutate(body);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionRow != null}
        onOpenChange={(o) => !o && setSessionRow(null)}
        tenantSlug={tenantSlug}
        staffKind="collector"
        userId={sessionRow?.id ?? null}
        maxSessions={sessionRow?.max_sessions ?? 2}
        onPatched={() => void qc.invalidateQueries({ queryKey: ["collectors", tenantSlug] })}
      />

      <Dialog open={Boolean(deactivateRow)} onOpenChange={(o) => !o && setDeactivateRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать инкассатора</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать инкассатора?</p>
          <DialogFooter className="flex-row justify-end gap-2 border-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => setDeactivateRow(null)}>
              Нет
            </Button>
            <Button type="button" variant="destructive" disabled={deactivateMut.isPending} onClick={() => deactivateRow && deactivateMut.mutate(deactivateRow.id)}>
              Да
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CollectorEditDialog({
  row,
  onClose,
  onPatch
}: {
  row: CollectorRow | null;
  onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [territory, setTerritory] = useState("");

  useEffect(() => {
    if (!row) return;
    const parts = row.fio.split(/\s+/);
    setLast(parts[0] ?? "");
    setFirst(parts[1] ?? parts[0] ?? "");
    setMid(parts[2] ?? "");
    setPhone(row.phone ?? "");
    setCode(row.code ?? "");
    setPinfl(row.pinfl ?? "");
    setBranch(row.branch ?? "");
    setPosition(row.position ?? "");
    setTerritory(row.territory ?? "");
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Редактировать</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input placeholder="Филиал" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <Input placeholder="Должность" value={position} onChange={(e) => setPosition(e.target.value)} />
          <Input className="sm:col-span-2" placeholder="Территория" value={territory} onChange={(e) => setTerritory(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            disabled={saving || !row}
            onClick={async () => {
              if (!row) return;
              setSaving(true);
              try {
                await onPatch(row.id, {
                  first_name: first_name.trim(),
                  last_name: last_name.trim() || null,
                  middle_name: middle_name.trim() || null,
                  phone: phone.trim() || null,
                  code: code.trim() || null,
                  pinfl: pinfl.trim() || null,
                  branch: branch.trim() || null,
                  position: position.trim() || null,
                  territory: territory.trim() || null
                });
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectorAddDialog({
  open,
  onOpenChange,
  loading,
  submitError,
  onSubmit
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  submitError: string | null;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [middle_name, setMid] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pinfl, setPinfl] = useState("");
  const [branch, setBranch] = useState("");
  const [position, setPosition] = useState("");
  const [territory, setTerritory] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [can_authorize, setCanAuthorize] = useState(true);
  const [app_access, setAppAccess] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setFirst("");
          setLast("");
          setMid("");
          setPhone("");
          setCode("");
          setPinfl("");
          setBranch("");
          setPosition("");
          setTerritory("");
          setLogin("");
          setPassword("");
          setCanAuthorize(true);
          setAppAccess(true);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Добавить инкассатора</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Имя *" value={first_name} onChange={(e) => setFirst(e.target.value)} />
          <Input placeholder="Фамилия" value={last_name} onChange={(e) => setLast(e.target.value)} />
          <Input placeholder="Отчество" value={middle_name} onChange={(e) => setMid(e.target.value)} />
          <Input placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Код" value={code} onChange={(e) => setCode(e.target.value)} />
          <Input placeholder="ПИНФЛ" value={pinfl} onChange={(e) => setPinfl(e.target.value)} />
          <Input placeholder="Филиал" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <Input placeholder="Должность" value={position} onChange={(e) => setPosition(e.target.value)} />
          <Input className="sm:col-span-2" placeholder="Территория" value={territory} onChange={(e) => setTerritory(e.target.value)} />
          <Input className="sm:col-span-2 font-mono" placeholder="Логин *" value={login} onChange={(e) => setLogin(e.target.value)} />
          <Input className="sm:col-span-2" type="password" placeholder="Пароль * (min 6)" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={can_authorize} onChange={(e) => setCanAuthorize(e.target.checked)} />
            Авторизация включена
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={app_access} onChange={(e) => setAppAccess(e.target.checked)} />
            Доступ к приложению
          </label>
        </div>
        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={loading || !first_name.trim() || !login.trim() || password.trim().length < 6}
            onClick={() =>
              onSubmit({
                first_name: first_name.trim(),
                last_name: last_name.trim() || null,
                middle_name: middle_name.trim() || null,
                phone: phone.trim() || null,
                code: code.trim() || null,
                pinfl: pinfl.trim() || null,
                branch: branch.trim() || null,
                position: position.trim() || null,
                territory: territory.trim() || null,
                login: login.trim(),
                password,
                can_authorize,
                app_access
              })
            }
          >
            {loading ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
