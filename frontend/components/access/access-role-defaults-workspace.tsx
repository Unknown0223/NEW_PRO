"use client";

import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Link2,
  Plus,
  Search
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
import { splitPermissionPath } from "@/lib/access-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import { AccessRoleDefaultsAddModal } from "./access-role-defaults-add-modal";
import {
  buildRoleGrantedGroups,
  roleOpCollator,
  roleOpDisplayLabel,
  shortenPathLabel,
  type RoleGrantedOpRow
} from "./access-role-defaults-ops.logic";

type RoleDefaultRow = {
  id: number;
  key: string;
  name: string;
  operations_count: number;
  permissions: string[];
};

type CatalogRow = {
  key: string;
  module: string;
  section: string | null;
  action: string | null;
  description: string | null;
  parent_path: string;
};

function RoleDefaultsInfoEmptyState() {
  return (
    <div className="flex min-h-[min(280px,45vh)] flex-1 flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted/80">
        <Search className="size-7 text-muted-foreground/70" strokeWidth={1.25} aria-hidden />
      </div>
      <p className="text-center text-sm text-muted-foreground">Никакой информации не найдено!!!</p>
    </div>
  );
}

export function AccessRoleDefaultsWorkspace({
  tenantSlug,
  className
}: {
  tenantSlug: string;
  className?: string;
}) {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(() => new Set());
  const [groupExpanded, setGroupExpanded] = useState<Set<string>>(() => new Set());
  const [tableSearch, setTableSearch] = useState("");
  const [filterParentDraft, setFilterParentDraft] = useState("");
  const [filterParent, setFilterParent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkSel, setBulkSel] = useState<Set<string>>(() => new Set());
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRoleIdRef = useRef<number | null>(null);
  const bulkHeaderCheckboxRef = useRef<HTMLInputElement>(null);

  const rolesQ = useQuery({
    queryKey: ["access-role-defaults", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await api.get<{ data: RoleDefaultRow[] }>(
        `/api/${tenantSlug}/access/role-defaults`
      );
      return data.data;
    }
  });

  const catalogQ = useQuery({
    queryKey: ["access-permission-catalog", tenantSlug],
    enabled: Boolean(tenantSlug) && selectedRoleId != null,
    queryFn: async () => {
      const { data } = await api.get<{ data: { flat: CatalogRow[] } }>(
        `/api/${tenantSlug}/access/permissions/catalog`
      );
      return data.data;
    }
  });

  const selectedRole = useMemo(
    () => (rolesQ.data ?? []).find((r) => r.id === selectedRoleId) ?? null,
    [rolesQ.data, selectedRoleId]
  );

  useEffect(() => {
    const rows = rolesQ.data;
    if (!rows?.length) {
      setSelectedRoleId(null);
      return;
    }
    if (selectedRoleId != null && !rows.some((r) => r.id === selectedRoleId)) {
      setSelectedRoleId(null);
    }
  }, [rolesQ.data, selectedRoleId]);

  const rolePermsSyncKey = useMemo(() => {
    if (!selectedRole) return "";
    return `${selectedRole.id}:${[...(selectedRole.permissions ?? [])].sort().join("\u0001")}`;
  }, [selectedRole]);

  useEffect(() => {
    if (!selectedRole) {
      setLocalPermissions(new Set());
      return;
    }
    setLocalPermissions(new Set(selectedRole.permissions ?? []));
  }, [rolePermsSyncKey, selectedRole]);

  useEffect(() => {
    setGroupExpanded(new Set());
    setBulkSel(new Set());
    setBulkFeedback(null);
    setTableSearch("");
    setFilterParent("");
    setFilterParentDraft("");
    setAddOpen(false);
  }, [selectedRoleId]);

  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingSaveRoleIdRef.current = null;
    setSaveError(null);
  }, [selectedRoleId]);

  const saveMut = useMutation({
    mutationFn: async (payload: { roleId: number; permissions: string[] }) => {
      await api.put(`/api/${tenantSlug}/access/role-defaults/${payload.roleId}`, {
        permissions: payload.permissions
      });
    },
    onMutate: () => setSaveError(null),
    onError: (err: unknown) => {
      const ax = err as AxiosError<{ error?: string; message?: string }>;
      const flat = getZodFlattenFromApiErrorBody(ax.response?.data);
      if (flat) {
        const hint = firstValidationUserHint(flat);
        setSaveError(withApiSupportLine(hint ?? "Ma’lumotlarni tekshiring.", err));
        return;
      }
      setSaveError(getUserFacingError(err, "Не удалось сохранить настройки роли."));
    },
    onSuccess: (_data, variables) => {
      qc.setQueryData<RoleDefaultRow[]>(["access-role-defaults", tenantSlug], (old) => {
        if (!old) return old;
        return old.map((r) =>
          r.id === variables.roleId
            ? {
                ...r,
                permissions: variables.permissions,
                operations_count: variables.permissions.length
              }
            : r
        );
      });
      invalidateMePermissionsQueries(qc, tenantSlug);
    }
  });

  const persistNow = useCallback(
    (roleId: number, next: Set<string>) => {
      const perms = [...next].sort((a, b) => roleOpCollator.compare(a, b));
      void saveMut.mutateAsync({ roleId, permissions: perms });
    },
    [saveMut]
  );

  const schedulePersist = useCallback(
    (roleId: number, next: Set<string>) => {
      pendingSaveRoleIdRef.current = roleId;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const rid = pendingSaveRoleIdRef.current;
        if (rid == null) return;
        persistNow(rid, next);
      }, 450);
    },
    [persistNow]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const catalogByKey = useMemo(() => {
    const m = new Map<string, CatalogRow>();
    for (const r of catalogQ.data?.flat ?? []) m.set(r.key, r);
    return m;
  }, [catalogQ.data]);

  const grantedRows = useMemo((): RoleGrantedOpRow[] => {
    const rows: RoleGrantedOpRow[] = [];
    for (const key of localPermissions) {
      const cat = catalogByKey.get(key);
      rows.push({
        key,
        module: cat?.module ?? key.split(".")[0] ?? "",
        section: cat?.section ?? null,
        description: cat?.description ?? null,
        parent_path: cat?.parent_path?.trim() || "—"
      });
    }
    rows.sort((a, b) => {
      const c = roleOpCollator.compare(roleOpDisplayLabel(a), roleOpDisplayLabel(b));
      return c !== 0 ? c : roleOpCollator.compare(a.key, b.key);
    });
    return rows;
  }, [localPermissions, catalogByKey]);

  const parentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of grantedRows) {
      const parts = splitPermissionPath(r.parent_path);
      if (parts[0]) s.add(parts[0]);
      if (r.parent_path.trim()) s.add(r.parent_path.trim());
    }
    return [...s].sort((a, b) => roleOpCollator.compare(a, b));
  }, [grantedRows]);

  const filteredGranted = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const p = filterParent.trim();
    return grantedRows.filter((row) => {
      if (p) {
        const parts = splitPermissionPath(row.parent_path);
        if (parts[0] !== p && row.parent_path !== p) return false;
      }
      if (!q) return true;
      const hay = `${row.key} ${roleOpDisplayLabel(row)} ${row.parent_path} ${row.section ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [grantedRows, tableSearch, filterParent]);

  const rowGroups = useMemo(() => buildRoleGrantedGroups(filteredGranted), [filteredGranted]);

  const expandKeys = useMemo(
    () => rowGroups.flatMap((g) => [g.parent, ...g.children.map((c) => c.parent)]),
    [rowGroups]
  );

  useEffect(() => {
    setGroupExpanded(new Set());
  }, [selectedRoleId, filterParent, tableSearch]);

  const groupsAllExpanded =
    expandKeys.length > 0 && expandKeys.every((k) => groupExpanded.has(k));

  const visibleKeys = useMemo(() => filteredGranted.map((r) => r.key), [filteredGranted]);

  useEffect(() => {
    const el = bulkHeaderCheckboxRef.current;
    if (!el) return;
    const all = visibleKeys.length > 0 && visibleKeys.every((k) => bulkSel.has(k));
    const some = visibleKeys.some((k) => bulkSel.has(k)) && !all;
    el.indeterminate = some;
    el.checked = all;
  }, [bulkSel, visibleKeys]);

  const detachKeys = useCallback(
    (keys: string[]) => {
      if (!selectedRole || keys.length === 0) return;
      setLocalPermissions((prev) => {
        const n = new Set(prev);
        for (const k of keys) n.delete(k);
        schedulePersist(selectedRole.id, n);
        return n;
      });
      setBulkSel((prev) => {
        const n = new Set(prev);
        for (const k of keys) n.delete(k);
        return n;
      });
      setBulkFeedback(`Откреплено: ${keys.length}`);
    },
    [selectedRole, schedulePersist]
  );

  const addKeys = useCallback(
    (keys: string[]) => {
      if (!selectedRole || keys.length === 0) return;
      setLocalPermissions((prev) => {
        const n = new Set(prev);
        for (const k of keys) n.add(k);
        // Modal save — darhol yozamiz
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        persistNow(selectedRole.id, n);
        return n;
      });
      setAddOpen(false);
      setBulkFeedback(`Добавлено: ${keys.length}`);
    },
    [selectedRole, persistNow]
  );

  const toggleGroupSel = (keys: string[], checked: boolean) => {
    setBulkSel((prev) => {
      const n = new Set(prev);
      if (checked) for (const k of keys) n.add(k);
      else for (const k of keys) n.delete(k);
      return n;
    });
  };

  const renderDataRow = (row: RoleGrantedOpRow) => (
    <tr key={row.key} className="border-b border-border/40 hover:bg-muted/30">
      <td className="w-10 px-2 py-1.5 align-middle">
        <input
          type="checkbox"
          className="h-4 w-4 accent-teal-700"
          checked={bulkSel.has(row.key)}
          disabled={saveMut.isPending}
          onChange={(e) => {
            setBulkSel((prev) => {
              const n = new Set(prev);
              if (e.target.checked) n.add(row.key);
              else n.delete(row.key);
              return n;
            });
          }}
          aria-label={`Выбрать ${roleOpDisplayLabel(row)}`}
        />
      </td>
      <td className="min-w-[12rem] px-2 py-1.5 align-middle text-xs">
        <div className="font-medium leading-snug text-foreground">{roleOpDisplayLabel(row)}</div>
        <div className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">{row.key}</div>
      </td>
      <td className="max-w-[10rem] px-2 py-1.5 align-middle text-xs text-muted-foreground">
        <span className="line-clamp-2" title={row.parent_path}>
          {shortenPathLabel(row.parent_path)}
        </span>
      </td>
      <td className="max-w-[8rem] px-2 py-1.5 align-middle text-xs text-muted-foreground">
        {(row.section ?? "").trim() || "—"}
      </td>
      <td className="whitespace-nowrap px-2 py-1.5 align-middle text-right">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={saveMut.isPending}
          title="Убрать операцию из роли"
          onClick={() => detachKeys([row.key])}
        >
          <Link2 className="h-3 w-3" aria-hidden />
          Открепить
        </Button>
      </td>
    </tr>
  );

  return (
    <div
      className={cn(
        "access-surface grid min-h-0 flex-1 gap-3 p-3 md:grid-cols-[minmax(260px,320px)_1fr] md:items-stretch md:gap-4",
        className
      )}
    >
      <div className="access-left-panel flex min-h-0 min-w-0 flex-col p-2">
        <div className="access-split-scroll-panel flex min-h-0 flex-1 flex-col">
          <div className="access-list-cap flex justify-between gap-2">
            <span>Роли по умолчанию</span>
            <span className="font-normal tabular-nums text-muted-foreground">
              {(rolesQ.data ?? []).length}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
            {rolesQ.isLoading ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">Загрузка…</p>
            ) : rolesQ.isError ? (
              <div className="space-y-2 px-1 py-4 text-center text-xs">
                <p className="text-destructive">Не удалось загрузить роли.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => void rolesQ.refetch()}
                >
                  Повторить
                </Button>
              </div>
            ) : (rolesQ.data ?? []).length === 0 ? (
              <div className="space-y-1 px-1 py-4 text-center text-xs text-muted-foreground">
                <p>Нет ролей в tenant.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 h-8 text-xs"
                  onClick={() => void rolesQ.refetch()}
                >
                  Обновить список
                </Button>
              </div>
            ) : (
              (rolesQ.data ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  data-active={selectedRoleId === r.id}
                  className="access-item-card w-full px-3 py-3 text-left text-sm hover:bg-muted/40"
                >
                  <div className="font-medium">{r.name || r.key}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    <span>{r.operations_count} операций</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="access-right-panel flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-3 md:p-4">
        {!selectedRole ? (
          <RoleDefaultsInfoEmptyState />
        ) : catalogQ.isLoading ? (
          <div className="flex min-h-[min(200px,35vh)] flex-1 flex-col items-center justify-center px-4">
            <p className="text-sm text-muted-foreground">Загрузка каталога операций…</p>
          </div>
        ) : catalogQ.isError ? (
          <div className="flex min-h-[min(200px,35vh)] flex-1 flex-col items-center justify-center px-4">
            <p className="text-sm text-destructive">Не удалось загрузить каталог.</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {saveError ? (
              <p className="shrink-0 text-sm text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}

            <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                  Показаны операции, входящие в роль «{selectedRole.name || selectedRole.key}». Добавление — через
                  «Добавить операции»; снятие — «Открепить» или массово внизу. Изменения сохраняются для всех
                  пользователей с этой ролью.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 gap-1 bg-teal-700 px-2.5 text-[11px] text-white hover:bg-teal-800"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Добавить операции
                </Button>
              </div>
              <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
              <div className="flex w-full flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-2">
                  <button
                    type="button"
                    title={groupsAllExpanded ? "Свернуть все группы" : "Развернуть все группы"}
                    disabled={rowGroups.length === 0}
                    onClick={() => {
                      if (groupsAllExpanded) setGroupExpanded(new Set());
                      else setGroupExpanded(new Set(expandKeys));
                    }}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium shadow-sm transition-colors",
                      rowGroups.length === 0 && "cursor-not-allowed opacity-50",
                      groupsAllExpanded
                        ? "border-teal-700/35 bg-teal-600 text-white hover:bg-teal-700"
                        : "border-sky-600/40 bg-sky-600 text-white hover:bg-sky-700"
                    )}
                  >
                    {groupsAllExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="max-sm:sr-only">
                      {groupsAllExpanded ? "Свернуть" : "Развернуть"}
                    </span>
                  </button>
                  <select
                    className="access-filter-select w-full max-w-[16rem]"
                    value={filterParentDraft}
                    onChange={(e) => setFilterParentDraft(e.target.value)}
                    title="Родитель"
                  >
                    <option value="">Родитель</option>
                    {parentOptions.map((opt) => (
                      <option key={opt} value={opt} title={opt}>
                        {shortenPathLabel(opt)}
                      </option>
                    ))}
                  </select>
                  <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по таблице"
                      className="h-8 w-full pl-8 text-xs"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-teal-700 px-3 text-[11px] text-white hover:bg-teal-800"
                  onClick={() => setFilterParent(filterParentDraft)}
                >
                  Применить
                </Button>
              </div>
            </div>

            {bulkFeedback ? (
              <p role="status" className="shrink-0 text-xs text-muted-foreground">
                {bulkFeedback}
              </p>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-card">
              {filteredGranted.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10">
                  <p className="text-center text-sm text-muted-foreground">
                    {grantedRows.length === 0
                      ? "В роли пока нет операций. Добавьте через «Добавить операции»."
                      : "Ничего не найдено по фильтру"}
                  </p>
                  {grantedRows.length === 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1 bg-teal-700 text-white hover:bg-teal-800"
                      onClick={() => setAddOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Добавить операции
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                      <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                        <th className="w-10 px-2 py-2">
                          <input
                            ref={bulkHeaderCheckboxRef}
                            type="checkbox"
                            className="h-4 w-4 accent-teal-700"
                            disabled={visibleKeys.length === 0 || saveMut.isPending}
                            onChange={(e) => {
                              if (e.target.checked) setBulkSel(new Set(visibleKeys));
                              else setBulkSel(new Set());
                            }}
                            aria-label="Выбрать все видимые"
                          />
                        </th>
                        <th className="px-2 py-2">Описание</th>
                        <th className="px-2 py-2">Родитель</th>
                        <th className="px-2 py-2">Раздел</th>
                        <th className="px-2 py-2 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowGroups.map((grp) => {
                        const open = groupExpanded.has(grp.parent);
                        const gKeys = grp.rows.map((r) => r.key);
                        const gAll = gKeys.length > 0 && gKeys.every((k) => bulkSel.has(k));
                        const gSome = gKeys.some((k) => bulkSel.has(k)) && !gAll;
                        return (
                          <Fragment key={grp.id}>
                            <tr className="border-b border-border/50 bg-muted/40">
                              <td className="px-2 py-1.5">
                                <IndeterminateCheckbox
                                  checked={gAll}
                                  indeterminate={gSome}
                                  disabled={saveMut.isPending || gKeys.length === 0}
                                  className="h-4 w-4 accent-teal-700"
                                  onChange={(e) => toggleGroupSel(gKeys, e.target.checked)}
                                />
                              </td>
                              <td colSpan={4} className="px-2 py-1.5">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 text-left text-xs font-semibold"
                                  onClick={() =>
                                    setGroupExpanded((prev) => {
                                      const n = new Set(prev);
                                      if (n.has(grp.parent)) n.delete(grp.parent);
                                      else n.add(grp.parent);
                                      return n;
                                    })
                                  }
                                >
                                  {open ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span className="truncate">{shortenPathLabel(grp.label)}</span>
                                  <span className="font-normal text-muted-foreground">
                                    ({grp.rows.length})
                                  </span>
                                </button>
                              </td>
                            </tr>
                            {open ? (
                              <>
                                {grp.directRows.map(renderDataRow)}
                                {grp.children.map((child) => {
                                  const childOpen = groupExpanded.has(child.parent);
                                  const cKeys = child.rows.map((r) => r.key);
                                  const cAll =
                                    cKeys.length > 0 && cKeys.every((k) => bulkSel.has(k));
                                  const cSome =
                                    cKeys.some((k) => bulkSel.has(k)) && !cAll;
                                  return (
                                    <Fragment key={child.id}>
                                      <tr className="border-b border-border/40 bg-muted/20">
                                        <td className="px-2 py-1 pl-6">
                                          <IndeterminateCheckbox
                                            checked={cAll}
                                            indeterminate={cSome}
                                            disabled={saveMut.isPending || cKeys.length === 0}
                                            className="h-4 w-4 accent-teal-700"
                                            onChange={(e) =>
                                              toggleGroupSel(cKeys, e.target.checked)
                                            }
                                          />
                                        </td>
                                        <td colSpan={4} className="px-2 py-1">
                                          <button
                                            type="button"
                                            className="flex w-full items-center gap-2 text-left text-xs font-medium"
                                            onClick={() =>
                                              setGroupExpanded((prev) => {
                                                const n = new Set(prev);
                                                if (n.has(child.parent)) n.delete(child.parent);
                                                else n.add(child.parent);
                                                return n;
                                              })
                                            }
                                          >
                                            {childOpen ? (
                                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            ) : (
                                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            )}
                                            <span className="truncate">
                                              {shortenPathLabel(child.label)}
                                            </span>
                                            <span className="font-normal text-muted-foreground">
                                              ({child.rows.length})
                                            </span>
                                          </button>
                                        </td>
                                      </tr>
                                      {childOpen ? child.rows.map(renderDataRow) : null}
                                    </Fragment>
                                  );
                                })}
                              </>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {bulkSel.size > 0 ? (
              <AccessBulkBottomBar
                variant="operations"
                selectedCount={bulkSel.size}
                totalVisibleCount={visibleKeys.length}
                onClear={() => setBulkSel(new Set())}
                busy={saveMut.isPending}
                onDetach={() => detachKeys([...bulkSel])}
                detachDisabled={bulkSel.size === 0}
                detachTitle="Убрать выбранные операции из роли"
                detachWithLinkIcon
              />
            ) : null}

            <AccessRoleDefaultsAddModal
              open={addOpen}
              onOpenChange={setAddOpen}
              roleName={selectedRole.name || selectedRole.key}
              catalog={catalogQ.data?.flat ?? []}
              grantedKeys={localPermissions}
              saving={saveMut.isPending}
              onSave={addKeys}
            />
          </div>
        )}
      </div>
    </div>
  );
}
