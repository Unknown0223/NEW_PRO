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
import { MonitorSmartphone, Pencil, RefreshCw, Settings2, UserMinus } from "lucide-react";
import { StaffActiveSessionsDialog } from "@/components/staff/staff-active-sessions-dialog";
import { messageFromStaffCreateError } from "@/lib/staff-api-errors";
type AuditorRow = {
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
  is_active: boolean;
  agent_entitlements?: Record<string, unknown> & { mobile_config?: unknown };
};

type Props = { tenantSlug: string };

export function AuditorsWorkspace({ tenantSlug }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [draftPos, setDraftPos] = useState("");
  const [draftTerritory, setDraftTerritory] = useState("");
  const [appliedPos, setAppliedPos] = useState("");
  const [appliedTerritory, setAppliedTerritory] = useState("");
  const [editRow, setEditRow] = useState<AuditorRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sessionRow, setSessionRow] = useState<AuditorRow | null>(null);
  const [deactivateRow, setDeactivateRow] = useState<AuditorRow | null>(null);
  const [configRow, setConfigRow] = useState<AuditorRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const filterQ = useQuery({
    queryKey: ["auditors-filter-options", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { positions: string[]; territories: string[] } }>(
        `/api/${tenantSlug}/auditors/filter-options`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: ["auditors", tenantSlug, tab, appliedPos, appliedTerritory],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("is_active", tab === "active" ? "true" : "false");
      if (appliedPos.trim()) p.set("position", appliedPos.trim());
      if (appliedTerritory.trim()) p.set("territory", appliedTerritory.trim());
      const { data } = await api.get<{ data: AuditorRow[] }>(`/api/${tenantSlug}/auditors?${p.toString()}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (vars: { id: number; body: Record<string, unknown> }) => {
      const { data } = await api.patch<AuditorRow>(`/api/${tenantSlug}/auditors/${vars.id}`, vars.body);
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["auditors-filter-options", tenantSlug] });
    }
  });

  const createMut = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await api.post<AuditorRow>(`/api/${tenantSlug}/auditors`, body);
      return data;
    },
    onSuccess: () => {
      setCreateError(null);
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
      void qc.invalidateQueries({ queryKey: ["auditors-filter-options", tenantSlug] });
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
      await api.patch(`/api/${tenantSlug}/auditors/${id}`, { is_active: false });
    },
    onSuccess: () => {
      setDeactivateRow(null);
      void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] });
    }
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src = listQ.data ?? [];
    if (!q) return src;
    return src.filter((r) =>
      [r.fio, r.login, r.phone ?? "", r.code ?? "", r.pinfl ?? "", r.branch ?? "", r.position ?? "", r.device_name ?? "", r.territory ?? ""]
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
              Добавить аудитор
            </Button>
          </div>

          <div className="flex border-b border-border/80 px-4">
            <button type="button" className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === "active" ? "border-primary text-primary" : "border-transparent")} onClick={() => setTab("active")}>
              Активный
            </button>
            <button type="button" className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === "inactive" ? "border-primary text-primary" : "border-transparent")} onClick={() => setTab("inactive")}>
              Не активный
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] text-xs">
              <thead className="app-table-thead">
                <tr>
                  <th className="px-2 py-2 text-left">Ф.И.О</th>
                  <th className="px-2 py-2 text-left">Авторизоваться</th>
                  <th className="px-2 py-2 text-left">Телефон</th>
                  <th className="px-2 py-2 text-left">Код</th>
                  <th className="px-2 py-2 text-left">Территория</th>
                  <th className="px-2 py-2 text-left">Версия APK</th>
                  <th className="px-2 py-2 text-left">ПИНФЛ</th>
                  <th className="px-2 py-2 text-left">Филиал</th>
                  <th className="px-2 py-2 text-left">Должность</th>
                  <th className="px-2 py-2 text-left">Название устройства</th>
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
                    <td className="px-2 py-2">su({r.login})</td>
                    <td className="px-2 py-2">{r.phone ?? "—"}</td>
                    <td className="px-2 py-2">{r.code ?? "—"}</td>
                    <td className="px-2 py-2">{r.territory ?? "—"}</td>
                    <td className="px-2 py-2">{r.apk_version ?? "—"}</td>
                    <td className="px-2 py-2">{r.pinfl ?? "—"}</td>
                    <td className="px-2 py-2">{r.branch ?? "—"}</td>
                    <td className="px-2 py-2">{r.position ?? "—"}</td>
                    <td className="px-2 py-2">{r.device_name ?? "—"}</td>
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
                      <TableRowActionGroup className="justify-end" ariaLabel="Auditor">
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setConfigRow(r)} title="Конфигурации">
                          <Settings2 className="size-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSessionRow(r)} title="Сессии">
                          <MonitorSmartphone className="size-3.5" />
                        </Button>
                        <Button type="button" variant="outline" size="icon-sm" onClick={() => setEditRow(r)} title="Редактировать">
                          <Pencil className="size-3.5" />
                        </Button>
                        {tab === "active" ? (
                          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeactivateRow(r)} title="Деактивировать">
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

      <AuditorEditDialog row={editRow} onClose={() => setEditRow(null)} onPatch={(id, body) => patchMut.mutateAsync({ id, body })} />
      <AuditorAddDialog
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
      <AuditorConfigDialog
        row={configRow}
        onClose={() => setConfigRow(null)}
        onSave={async (id, photoRequired) => {
          const prevEnt = (configRow?.agent_entitlements ?? {}) as Record<string, unknown>;
          const prevMc =
            prevEnt.mobile_config && typeof prevEnt.mobile_config === "object" && !Array.isArray(prevEnt.mobile_config)
              ? (prevEnt.mobile_config as Record<string, unknown>)
              : {};
          await patchMut.mutateAsync({
            id,
            body: {
              agent_entitlements: {
                ...prevEnt,
                mobile_config: {
                  ...prevMc,
                  schema_version: 1,
                  photo: {
                    ...(prevMc.photo && typeof prevMc.photo === "object" && !Array.isArray(prevMc.photo)
                      ? (prevMc.photo as Record<string, unknown>)
                      : {}),
                    required_for_order: photoRequired
                  }
                }
              }
            }
          });
          setConfigRow(null);
        }}
      />

      <StaffActiveSessionsDialog
        open={sessionRow != null}
        onOpenChange={(o) => !o && setSessionRow(null)}
        tenantSlug={tenantSlug}
        staffKind="auditor"
        userId={sessionRow?.id ?? null}
        maxSessions={sessionRow?.max_sessions ?? 2}
        onPatched={() => void qc.invalidateQueries({ queryKey: ["auditors", tenantSlug] })}
      />

      <Dialog open={Boolean(deactivateRow)} onOpenChange={(o) => !o && setDeactivateRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Деактивировать аудитора</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Вы хотите деактивировать аудитора?</p>
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

function AuditorEditDialog({
  row,
  onClose,
  onPatch
}: {
  row: AuditorRow | null;
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

function AuditorAddDialog({
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Добавить аудитор</DialogTitle>
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

function AuditorConfigDialog({
  row,
  onClose,
  onSave
}: {
  row: AuditorRow | null;
  onClose: () => void;
  onSave: (id: number, photoRequired: boolean) => Promise<void>;
}) {
  const [photoRequired, setPhotoRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!row) return;
    const mc = row.agent_entitlements?.mobile_config;
    const photo =
      mc && typeof mc === "object" && !Array.isArray(mc) ? (mc as Record<string, unknown>).photo : undefined;
    const required =
      photo && typeof photo === "object" && !Array.isArray(photo)
        ? Boolean((photo as Record<string, unknown>).required_for_order)
        : false;
    setPhotoRequired(required);
  }, [row]);

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Прикрепить/открепить все конфигурации</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded border border-border p-2 text-sm font-medium">Фото</div>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={photoRequired} onChange={(e) => setPhotoRequired(e.target.checked)} />
            Обязательная фото-фиксация для добавления заказа
          </label>
        </div>
        <DialogFooter className="justify-between">
          <Button variant="outline" className="border-red-500 text-red-600" onClick={() => setPhotoRequired(false)}>
            Сбросить настройки
          </Button>
          <Button
            disabled={saving || !row}
            onClick={async () => {
              if (!row) return;
              setSaving(true);
              try {
                await onSave(row.id, photoRequired);
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
