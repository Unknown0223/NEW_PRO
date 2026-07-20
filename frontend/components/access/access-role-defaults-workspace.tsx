"use client";

import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsDownUp, Link2, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { api } from "@/lib/api";
import { firstValidationUserHint, getZodFlattenFromApiErrorBody } from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

const matrixCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

/** CRUD grid ustunlari — backend `permission-model` bilan bir xil tartib/yorliq. */
const ACTION_COLUMNS: { action: string; labelRu: string; short: string }[] = [
  { action: "view", labelRu: "Просмотр", short: "Просм." },
  { action: "create", labelRu: "Создание", short: "Созд." },
  { action: "update", labelRu: "Изменение", short: "Изм." },
  { action: "delete", labelRu: "Удаление", short: "Удал." },
  { action: "void", labelRu: "Аннулирование", short: "Аннул." },
  { action: "restore", labelRu: "Восстановление", short: "Восст." },
  { action: "copy", labelRu: "Копирование/Выгрузка", short: "Копир." },
  { action: "activate", labelRu: "Активация", short: "Актив." },
  { action: "deactivate", labelRu: "Деактивация", short: "Деакт." },
  { action: "import", labelRu: "Импорт", short: "Импорт" },
  { action: "status", labelRu: "Изменение статуса", short: "Статус" },
  { action: "assign", labelRu: "Прикрепление", short: "Прикр." },
  { action: "approve", labelRu: "Утверждение", short: "Утв." },
  { action: "transfer", labelRu: "Перемещение", short: "Перем." },
  { action: "history", labelRu: "История", short: "Истор." }
];
const ACTION_INDEX: Record<string, number> = Object.fromEntries(ACTION_COLUMNS.map((c, i) => [c.action, i]));

type GridSection = {
  /** RU bo'lim yorlig'i (Раздел). */
  sectionLabel: string;
  /** «Родитель». */
  parent: string;
  /** action → permission key. */
  keyByAction: Map<string, string>;
};

function shortenPathLabel(path: string, max = 40): string {
  const t = path.trim();
  if (t.length <= max) return t;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = max - head - 1;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
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
  const [filterParent, setFilterParent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRoleIdRef = useRef<number | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollTopRef = useRef(0);
  const skipScrollRestoreRef = useRef(false);

  const rolesQ = useQuery({
    queryKey: ["access-role-defaults", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
    skipScrollRestoreRef.current = true;
    tableScrollTopRef.current = 0;
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
      // Rol default o‘zgarsa barcha shu rol sessiyalari menyuni yangilashi kerak.
      invalidateMePermissionsQueries(qc, tenantSlug);
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

  /** CRUD grid: «Родитель» bo'yicha guruh → har bir bo'lim qatori (Раздел) × amal ustunlari. */
  const gridGroups = useMemo(() => {
    type Acc = { parent: string; sections: Map<string, GridSection>; legacy: CatalogRow[] };
    const byParent = new Map<string, Acc>();
    for (const row of filteredFlat) {
      const parent = row.parent_path?.trim() || "—";
      let acc = byParent.get(parent);
      if (!acc) {
        acc = { parent, sections: new Map(), legacy: [] };
        byParent.set(parent, acc);
      }
      if (row.action && ACTION_INDEX[row.action] != null) {
        const label = (row.section && row.section.trim()) || parent;
        let gs = acc.sections.get(label);
        if (!gs) {
          gs = { sectionLabel: label, parent, keyByAction: new Map() };
          acc.sections.set(label, gs);
        }
        gs.keyByAction.set(row.action, row.key);
      } else {
        acc.legacy.push(row);
      }
    }
    const parents = [...byParent.keys()].sort((a, b) => matrixCollator.compare(a, b));
    return parents.map((parent) => {
      const acc = byParent.get(parent)!;
      const sections = [...acc.sections.values()].sort((a, b) =>
        matrixCollator.compare(a.sectionLabel, b.sectionLabel)
      );
      return { parent, sections, legacy: acc.legacy };
    });
  }, [filteredFlat]);

  /** Faqat joriy ko'rinishda ishlatilgan amal ustunlari (bo'sh ustunlarsiz). */
  const activeActionColumns = useMemo(() => {
    const used = new Set<string>();
    for (const g of gridGroups) {
      for (const s of g.sections) {
        for (const a of s.keyByAction.keys()) used.add(a);
      }
    }
    return ACTION_COLUMNS.filter((c) => used.has(c.action));
  }, [gridGroups]);

  const groupKeysSig = useMemo(() => JSON.stringify(gridGroups.map((g) => g.parent)), [gridGroups]);

  useEffect(() => {
    setGroupExpanded(new Set());
    skipScrollRestoreRef.current = true;
    tableScrollTopRef.current = 0;
  }, [groupKeysSig]);

  useLayoutEffect(() => {
    if (skipScrollRestoreRef.current) {
      skipScrollRestoreRef.current = false;
      return;
    }
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollTop = tableScrollTopRef.current;
  }, [localPermissions, saveMut.isPending]);

  /** Toggle fokusida brauzer scroll qilmasin. */
  const preventToggleFocusScroll = (e: MouseEvent) => {
    e.preventDefault();
  };

  const captureTableScroll = () => {
    tableScrollTopRef.current = tableScrollRef.current?.scrollTop ?? 0;
  };

  const groupsAllExpanded = useMemo(
    () => gridGroups.length > 0 && gridGroups.every((g) => groupExpanded.has(g.parent)),
    [gridGroups, groupExpanded]
  );

  /**
   * Bo‘lim qatori: yoqilganda faqat view (va list) — to‘liq CRUD emas.
   * O‘chirilganda bo‘limdagi barcha amallar olib tashlanadi.
   */
  const toggleSectionRow = (section: GridSection, checked: boolean) => {
    if (!selectedRole) return;
    captureTableScroll();
    setLocalPermissions((prev) => {
      const n = new Set(prev);
      if (checked) {
        const viewKey = section.keyByAction.get("view");
        const listKey = section.keyByAction.get("list");
        if (viewKey) n.add(viewKey);
        if (listKey) n.add(listKey);
        // Agar view yo‘q bo‘lsa (kamdan-kam) — hech narsa qo‘shilmaydi; alohida toggle ishlatilsin.
      } else {
        for (const key of section.keyByAction.values()) {
          n.delete(key);
        }
      }
      schedulePersist(selectedRole.id, n);
      return n;
    });
  };

  const togglePermission = (key: string, checked: boolean) => {
    if (!selectedRole) return;
    captureTableScroll();
    setLocalPermissions((prev) => {
      const n = new Set(prev);
      if (checked) n.add(key);
      else n.delete(key);
      schedulePersist(selectedRole.id, n);
      return n;
    });
  };

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
                  disabled={gridGroups.length === 0}
                  onClick={() => {
                    if (gridGroups.length === 0) return;
                    if (groupsAllExpanded) setGroupExpanded(new Set());
                    else setGroupExpanded(new Set(gridGroups.map((g) => g.parent)));
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

            {gridGroups.length === 0 ? (
              <RoleDefaultsInfoEmptyState />
            ) : (
              <div
                ref={tableScrollRef}
                className="access-split-scroll-panel min-h-0 flex-1 overflow-auto overscroll-contain"
                onScroll={() => {
                  tableScrollTopRef.current = tableScrollRef.current?.scrollTop ?? 0;
                }}
              >
                  <table className="access-matrix-table w-full">
                    <thead className="app-table-thead sticky top-0 z-10 bg-card">
                      <tr>
                        <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                          Раздел
                        </th>
                        {activeActionColumns.map((c) => (
                          <th
                            key={c.action}
                            scope="col"
                            className="w-[5.5rem] px-1 py-1 text-center align-middle text-[10px] font-semibold leading-tight"
                            title={c.labelRu}
                          >
                            {c.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gridGroups.map((grp) => {
                        const open = groupExpanded.has(grp.parent);
                        const sectionCount = grp.sections.length + grp.legacy.length;
                        return (
                          <Fragment key={grp.parent}>
                            <tr className="border-t border-border/60 bg-muted/35">
                              <td colSpan={activeActionColumns.length + 1} className="px-2 py-1">
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
                                  <span className="shrink-0 font-normal text-muted-foreground">({sectionCount})</span>
                                </button>
                              </td>
                            </tr>
                            {open
                              ? grp.sections.map((section) => {
                                  const viewKey = section.keyByAction.get("view");
                                  const listKey = section.keyByAction.get("list");
                                  const sectionEnabled = Boolean(
                                    (viewKey && localPermissions.has(viewKey)) ||
                                      (listKey && localPermissions.has(listKey))
                                  );
                                  return (
                                    <tr
                                      key={`${grp.parent}::${section.sectionLabel}`}
                                      className="border-t border-border/50 transition-colors hover:bg-muted/25"
                                    >
                                      <td
                                        className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-xs"
                                        title={section.sectionLabel}
                                      >
                                        <label
                                          className="flex cursor-pointer items-center gap-2"
                                          onMouseDown={preventToggleFocusScroll}
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-3.5 w-3.5 accent-teal-600"
                                            checked={sectionEnabled}
                                            title="Включить раздел (только просмотр)"
                                            onChange={(e) => toggleSectionRow(section, e.target.checked)}
                                          />
                                          <span>{section.sectionLabel}</span>
                                        </label>
                                      </td>
                                      {activeActionColumns.map((c) => {
                                        const key = section.keyByAction.get(c.action);
                                        if (!key) {
                                          return (
                                            <td key={c.action} className="px-1 py-2 text-center align-middle text-muted-foreground/40">
                                              —
                                            </td>
                                          );
                                        }
                                        const inRole = localPermissions.has(key);
                                        return (
                                          <td key={c.action} className="px-1 py-2 text-center align-middle">
                                            <label
                                              className="relative mx-auto flex h-5 w-9 cursor-pointer items-center justify-center rounded-full"
                                              onMouseDown={preventToggleFocusScroll}
                                            >
                                              <input
                                                type="checkbox"
                                                role="switch"
                                                className="peer sr-only"
                                                checked={inRole}
                                                title={`${section.sectionLabel} · ${c.labelRu} (${key})`}
                                                onChange={(e) => togglePermission(key, e.target.checked)}
                                              />
                                              <span
                                                className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600"
                                                aria-hidden
                                              />
                                              <span
                                                className="pointer-events-none absolute left-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1rem]"
                                                aria-hidden
                                              />
                                            </label>
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                })
                              : null}
                            {open && grp.legacy.length > 0
                              ? grp.legacy.map((row) => {
                                  const inRole = localPermissions.has(row.key);
                                  return (
                                    <tr key={row.key} className="border-t border-dashed border-border/40 hover:bg-muted/20">
                                      <td
                                        className="min-w-0 break-words px-2 py-1.5 align-middle text-[11px] text-muted-foreground"
                                        title={(row.description && row.description.trim()) || row.key}
                                      >
                                        {displayAccessDescriptionShort(row.description, row.key)}
                                      </td>
                                      <td colSpan={Math.max(1, activeActionColumns.length)} className="px-1 py-1.5 text-left align-middle">
                                        <label
                                          className="inline-flex cursor-pointer items-center gap-2"
                                          onMouseDown={preventToggleFocusScroll}
                                        >
                                          <input
                                            type="checkbox"
                                            role="switch"
                                            className="peer sr-only"
                                            checked={inRole}
                                            onChange={(e) => togglePermission(row.key, e.target.checked)}
                                          />
                                          <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition-colors peer-checked:bg-teal-600">
                                            <span className="absolute left-0.5 h-3.5 w-3.5 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform peer-checked:translate-x-[1rem]" />
                                          </span>
                                          <span className="text-[10px] text-muted-foreground/70">прочая операция</span>
                                        </label>
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
