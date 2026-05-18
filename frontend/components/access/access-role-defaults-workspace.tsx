"use client";

import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsDownUp, Link2, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableSortButton, type TableSortDir } from "@/components/ui/table-sort-button";

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
  description: string | null;
  parent_path: string;
};

type MatrixSortKey = "description" | "parent" | "section" | "key";

const matrixCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

function shortenPathLabel(path: string, max = 40): string {
  const t = path.trim();
  if (t.length <= max) return t;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = max - head - 1;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

function compareCatalogRows(a: CatalogRow, b: CatalogRow, key: MatrixSortKey, dir: TableSortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  let c = 0;
  if (key === "description") {
    c = matrixCollator.compare(displayAccessDescriptionShort(a.description, a.key), displayAccessDescriptionShort(b.description, b.key)) * mult;
  } else if (key === "parent") {
    c = matrixCollator.compare(a.parent_path ?? "", b.parent_path ?? "") * mult;
  } else if (key === "section") {
    c = matrixCollator.compare(displayAccessDescriptionShort(a.section, "—"), displayAccessDescriptionShort(b.section, "—")) * mult;
  } else {
    c = matrixCollator.compare(a.key, b.key) * mult;
  }
  if (c !== 0) return c;
  return matrixCollator.compare(a.key, b.key);
}

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

export function AccessRoleDefaultsWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Set<string>>(() => new Set());
  const [groupExpanded, setGroupExpanded] = useState<Set<string>>(() => new Set());
  const [tableSearch, setTableSearch] = useState("");
  const [filterParent, setFilterParent] = useState("");
  const [matrixSort, setMatrixSort] = useState<null | { key: MatrixSortKey; dir: TableSortDir }>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const headScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRoleIdRef = useRef<number | null>(null);

  const onHeadScroll = useCallback(() => {
    const head = headScrollRef.current;
    const body = bodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(body.scrollLeft - head.scrollLeft) < 1) return;
    body.scrollLeft = head.scrollLeft;
  }, []);

  const onBodyScroll = useCallback(() => {
    const head = headScrollRef.current;
    const body = bodyScrollRef.current;
    if (!head || !body) return;
    if (Math.abs(head.scrollLeft - body.scrollLeft) < 1) return;
    head.scrollLeft = body.scrollLeft;
  }, []);

  const rolesQ = useQuery({
    queryKey: ["access-role-defaults", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data } = await api.get<{ data: RoleDefaultRow[] }>(`/api/${tenantSlug}/access/role-defaults`);
      return data.data;
    }
  });

  const catalogQ = useQuery({
    queryKey: ["access-permission-catalog", tenantSlug],
    enabled: Boolean(tenantSlug) && selectedRoleId != null,
    queryFn: async () => {
      const { data } = await api.get<{ data: { flat: CatalogRow[] } }>(`/api/${tenantSlug}/access/permissions/catalog`);
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
    onMutate: () => {
      setSaveError(null);
    },
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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["access-role-defaults", tenantSlug] });
    }
  });

  const schedulePersist = useCallback(
    (roleId: number, next: Set<string>) => {
      pendingSaveRoleIdRef.current = roleId;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const rid = pendingSaveRoleIdRef.current;
        if (rid == null) return;
        const perms = [...next].sort((a, b) => matrixCollator.compare(a, b));
        void saveMut.mutateAsync({ roleId: rid, permissions: perms });
      }, 450);
    },
    [saveMut]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const parentOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of catalogQ.data?.flat ?? []) {
      const v = r.parent_path?.trim();
      if (v) s.add(v);
    }
    return [...s].sort((a, b) => matrixCollator.compare(a, b));
  }, [catalogQ.data]);

  const filteredFlat = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const p = filterParent.trim();
    return (catalogQ.data?.flat ?? []).filter((row) => {
      if (p && row.parent_path !== p) return false;
      if (!q) return true;
      const hay = `${row.key} ${row.description ?? ""} ${row.parent_path} ${row.section ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [catalogQ.data, tableSearch, filterParent]);

  const sortedFlat = useMemo(() => {
    if (!matrixSort) return filteredFlat;
    return [...filteredFlat].sort((a, b) => compareCatalogRows(a, b, matrixSort.key, matrixSort.dir));
  }, [filteredFlat, matrixSort]);

  const matrixRowGroups = useMemo(() => {
    const m = new Map<string, CatalogRow[]>();
    for (const row of sortedFlat) {
      const k = row.parent_path?.trim() || "—";
      const arr = m.get(k) ?? [];
      arr.push(row);
      m.set(k, arr);
    }
    const keys = [...m.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return keys.map((parent) => ({ parent, rows: m.get(parent)! }));
  }, [sortedFlat]);

  const groupKeysSig = useMemo(() => JSON.stringify(matrixRowGroups.map((g) => g.parent)), [matrixRowGroups]);

  useEffect(() => {
    setGroupExpanded(new Set());
  }, [groupKeysSig]);

  const groupsAllExpanded = useMemo(
    () => matrixRowGroups.length > 0 && matrixRowGroups.every((g) => groupExpanded.has(g.parent)),
    [matrixRowGroups, groupExpanded]
  );

  const toggleSort = (key: MatrixSortKey) => {
    setMatrixSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const togglePermission = (key: string, checked: boolean) => {
    if (!selectedRole) return;
    setLocalPermissions((prev) => {
      const n = new Set(prev);
      if (checked) n.add(key);
      else n.delete(key);
      schedulePersist(selectedRole.id, n);
      return n;
    });
  };

  return (
    <div className="access-surface grid min-h-0 gap-3 p-3 md:grid-cols-[minmax(260px,320px)_1fr] md:items-stretch md:gap-4">
      <div className="access-left-panel flex min-h-[min(360px,calc(100vh-200px))] min-w-0 flex-col p-2">
        <div className="access-split-scroll-panel">
          <div className="access-list-cap flex justify-between gap-2">
            <span>Роли по умолчанию</span>
            <span className="font-normal tabular-nums text-muted-foreground">{(rolesQ.data ?? []).length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
            {rolesQ.isLoading ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">Загрузка…</p>
            ) : rolesQ.isError ? (
              <div className="space-y-2 px-1 py-4 text-center text-xs">
                <p className="text-destructive">Не удалось загрузить роли.</p>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void rolesQ.refetch()}>
                  Повторить
                </Button>
              </div>
            ) : (rolesQ.data ?? []).length === 0 ? (
              <div className="space-y-1 px-1 py-4 text-center text-xs text-muted-foreground">
                <p>Нет ролей в tenant.</p>
                <p className="text-[11px] leading-snug">
                  Обычно роли создаются при открытии страницы. Обновите (F5) или перезапустите API, если список не появился.
                </p>
                <Button type="button" size="sm" variant="outline" className="mt-1 h-8 text-xs" onClick={() => void rolesQ.refetch()}>
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
                    <span>
                      {r.operations_count} операций
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="access-right-panel flex h-full min-h-0 min-w-0 flex-col gap-3 p-3 md:p-4">
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
            {saveError ? (
              <p className="shrink-0 text-sm text-destructive" role="alert">
                {saveError}
              </p>
            ) : null}
            <p className="shrink-0 text-xs leading-snug text-muted-foreground">
              Операции из каталога, включённые в роль по умолчанию. Переключатель — есть ли право у всех пользователей с этой
              ролью (до личных настроек пользователя).
            </p>
            <div className="shrink-0 rounded-md border border-border bg-card p-2 shadow-sm">
              <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1 text-xs"
                  disabled={matrixRowGroups.length === 0}
                  onClick={() => {
                    if (matrixRowGroups.length === 0) return;
                    if (groupsAllExpanded) setGroupExpanded(new Set());
                    else setGroupExpanded(new Set(matrixRowGroups.map((g) => g.parent)));
                  }}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {groupsAllExpanded ? "Свернуть все" : "Развернуть все"}
                </Button>
                <div className="min-w-0 sm:max-w-[min(100%,16rem)]">
                  <label htmlFor="role-def-filter-parent" className="sr-only">
                    Родитель
                  </label>
                  <select
                    id="role-def-filter-parent"
                    className="access-filter-select w-full max-w-[16rem]"
                    value={filterParent}
                    onChange={(e) => setFilterParent(e.target.value)}
                  >
                    <option value="">Родитель (все)</option>
                    {parentOptions.map((opt) => (
                      <option key={opt} value={opt} title={opt}>
                        {shortenPathLabel(opt)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="relative min-w-[10rem] max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="role-def-table-search"
                    placeholder="Поиск по таблице"
                    className="h-8 pl-8 text-xs"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                  />
                </div>
                {saveMut.isPending ? (
                  <span className="text-[11px] text-muted-foreground">Сохранение…</span>
                ) : null}
              </div>
            </div>

            {matrixRowGroups.length === 0 ? (
              <RoleDefaultsInfoEmptyState />
            ) : (
              <div className="access-split-scroll-panel min-h-[280px] flex-1">
                <div ref={headScrollRef} className="access-split-scroll-head" onScroll={onHeadScroll}>
                  <table className="access-matrix-table">
                    <colgroup>
                      <col className="min-w-[8rem]" />
                      <col className="min-w-[6rem] w-[10rem]" />
                      <col className="min-w-[8rem] w-[12rem]" />
                      <col className="w-[10rem]" />
                      <col className="w-[8.5rem]" />
                    </colgroup>
                    <thead className="app-table-thead">
                      <tr>
                        <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                          <TableSortButton
                            label="Описание"
                            active={matrixSort?.key === "description"}
                            dir={matrixSort?.key === "description" ? matrixSort.dir : "asc"}
                            onClick={() => toggleSort("description")}
                          />
                        </th>
                        <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                          <TableSortButton
                            label="Родитель"
                            active={matrixSort?.key === "parent"}
                            dir={matrixSort?.key === "parent" ? matrixSort.dir : "asc"}
                            onClick={() => toggleSort("parent")}
                          />
                        </th>
                        <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                          <TableSortButton
                            label="Раздел"
                            active={matrixSort?.key === "section"}
                            dir={matrixSort?.key === "section" ? matrixSort.dir : "asc"}
                            onClick={() => toggleSort("section")}
                          />
                        </th>
                        <th
                          scope="col"
                          className="w-[10rem] px-1.5 py-1 text-center align-middle text-[10px] font-semibold leading-tight"
                        >
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="max-w-full text-center text-[8px] font-semibold leading-none">
                              В роли по умолчанию
                            </span>
                            <span className="text-[9px] font-normal text-muted-foreground">вкл / выкл</span>
                          </div>
                        </th>
                        <th scope="col" className="w-[8.5rem] px-2 py-1 text-center text-[10px] font-semibold leading-tight">
                          Ключ
                        </th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div ref={bodyScrollRef} className="access-split-scroll-body" onScroll={onBodyScroll}>
                  <table className="access-matrix-table">
                    <colgroup>
                      <col className="min-w-[8rem]" />
                      <col className="min-w-[6rem] w-[10rem]" />
                      <col className="min-w-[8rem] w-[12rem]" />
                      <col className="w-[10rem]" />
                      <col className="w-[8.5rem]" />
                    </colgroup>
                    <tbody>
                      {matrixRowGroups.map((grp) => {
                        const open = groupExpanded.has(grp.parent);
                        return (
                          <Fragment key={grp.parent}>
                            <tr className="border-t border-border/60 bg-muted/35">
                              <td colSpan={5} className="px-2 py-1">
                                <button
                                  type="button"
                                  className="flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-[11px] font-semibold text-foreground hover:bg-muted/40"
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
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                  )}
                                  <span className="min-w-0 truncate" title={grp.parent}>
                                    {shortenPathLabel(grp.parent)}
                                  </span>
                                  <span className="shrink-0 font-normal text-muted-foreground">({grp.rows.length})</span>
                                </button>
                              </td>
                            </tr>
                            {open
                              ? grp.rows.map((row) => {
                                  const inRole = localPermissions.has(row.key);
                                  return (
                                    <tr key={row.key} className="border-t border-border/50 transition-colors hover:bg-muted/25">
                                      <td
                                        className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-xs"
                                        title={(row.description && row.description.trim()) || undefined}
                                      >
                                        {displayAccessDescriptionShort(row.description, row.key)}
                                      </td>
                                      <td
                                        className="min-w-0 break-words px-2 py-2 align-middle text-xs text-muted-foreground"
                                        title={row.parent_path?.trim() || undefined}
                                      >
                                        {row.parent_path?.trim() || "—"}
                                      </td>
                                      <td
                                        className="min-w-0 break-words px-2 py-2 align-middle text-xs text-muted-foreground"
                                        title={(row.section && row.section.trim()) || undefined}
                                      >
                                        {displayAccessDescriptionShort(row.section, "—")}
                                      </td>
                                      <td className="w-[10rem] px-2 py-2 text-center align-middle">
                                        <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full">
                                          <input
                                            type="checkbox"
                                            role="switch"
                                            className="peer sr-only"
                                            checked={inRole}
                                            title={
                                              inRole
                                                ? "Операция входит в роль по умолчанию. Выключите — убрать из роли."
                                                : "Операция не в роли. Включите — добавить в роль по умолчанию."
                                            }
                                            onChange={(e) => togglePermission(row.key, e.target.checked)}
                                          />
                                          <span
                                            className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50"
                                            aria-hidden
                                          />
                                          <span
                                            className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                                            aria-hidden
                                          />
                                        </label>
                                      </td>
                                      <td className="w-[8.5rem] px-2 py-2 text-center align-middle font-mono text-[10px] text-muted-foreground">
                                        {row.key}
                                      </td>
                                    </tr>
                                  );
                                })
                              : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
