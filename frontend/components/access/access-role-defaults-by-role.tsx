"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronsDownUp, ChevronsUpDown, Link2, Search, Unlink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { accessRoleDisplayName } from "@/lib/access-role-label";
import { getUserFacingError } from "@/lib/error-utils";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterAccessTree,
  isFlatAccessModule,
  treeKeys,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { AccessCompactSwitch } from "@/components/access/access-compact-switch";
import {
  AccessRoleDefaultsOpPickTree,
  viewKeysOfOps
} from "@/components/access/access-role-defaults-op-pick-tree";

type RoleRow = {
  id: number;
  key: string;
  name: string;
  operations_count: number;
  permissions: string[];
};

/** «По роли»: rollarni massiv belgilash → operatsiyalarni bog‘lash (Прикрепить / Открепить). */
export function AccessRoleDefaultsByRole({
  tenantSlug,
  roles,
  rolesLoading
}: {
  tenantSlug: string;
  roles: RoleRow[];
  rolesLoading: boolean;
}) {
  const qc = useQueryClient();
  const treeQ = useAccessOperationsTree(tenantSlug);
  const [roleSearch, setRoleSearch] = useState("");
  const [search, setSearch] = useState("");
  const [roleIds, setRoleIds] = useState<Set<number>>(() => new Set());
  const [ops, setOps] = useState<Set<string>>(() => new Set());
  const [grantKeys, setGrantKeys] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const tree = treeQ.data ?? [];
  const visibleTree = useMemo(() => filterAccessTree(tree, search), [tree, search]);
  const flatIds = useMemo(() => new Set(tree.filter(isFlatAccessModule).map((m) => m.id)), [tree]);
  const groupIds = useMemo(
    () => visibleTree.flatMap((m) => [m.id, ...(flatIds.has(m.id) ? [] : m.sections.map((s) => s.id))]),
    [visibleTree, flatIds]
  );
  const allExpanded = groupIds.length > 0 && groupIds.every((id) => expanded.has(id));
  const searching = search.trim().length > 0;
  const visibleOpKeys = useMemo(() => treeKeys(visibleTree), [visibleTree]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      `${accessRoleDisplayName(r.key, r.name)} ${r.name} ${r.key}`.toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const selectedRoles = useMemo(
    () => roles.filter((r) => roleIds.has(r.id)),
    [roles, roleIds]
  );

  const soloRole = selectedRoles.length === 1 ? selectedRoles[0] : null;
  const soloPermKey = soloRole
    ? `${soloRole.id}:${[...soloRole.permissions].sort().join("\u0001")}`
    : "";

  /** Bitta rol — joriy tarkib; bir nechta — bo‘sh tanlov (massiv bog‘lash). */
  useEffect(() => {
    if (!soloPermKey) {
      setOps(new Set());
      setGrantKeys(new Set());
      return;
    }
    const id = Number(soloPermKey.split(":")[0]);
    const role = roles.find((r) => r.id === id);
    setOps(new Set(role?.permissions ?? []));
    setGrantKeys(new Set());
  }, [soloPermKey, roles]);

  const setKeys = (keys: string[], next: boolean) => {
    setOps((prev) => {
      const n = new Set(prev);
      for (const k of keys) {
        if (next) n.add(k);
        else n.delete(k);
      }
      return n;
    });
    if (!next) {
      setGrantKeys((prev) => {
        const n = new Set(prev);
        for (const k of keys) n.delete(k);
        return n;
      });
    }
  };

  const toggleViewDefault = (all: AccessTreeOperation[], next: boolean) => {
    if (!next) setKeys(all.map((o) => o.key), false);
    else setKeys(viewKeysOfOps(all), true);
  };

  const bindMut = useMutation({
    mutationFn: async (action: "attach" | "detach") => {
      const ids = [...roleIds];
      const opCount = ops.size;
      const roleCount = ids.length;
      await api.post(`/api/${tenantSlug}/access/role-defaults/bind`, {
        action,
        operation_keys: [...ops],
        role_ids: ids,
        role_grants:
          action === "attach"
            ? ids.map((id) => ({
                role_id: id,
                operation_keys: [...grantKeys].filter((k) => ops.has(k))
              }))
            : []
      });
      return { action, opCount, roleCount };
    },
    onSuccess: async ({ action, opCount, roleCount }) => {
      setError(null);
      setOkMsg(
        action === "attach"
          ? `Прикреплено: ${opCount} оп. → ${roleCount} рол.`
          : `Откреплено: ${opCount} оп. ← ${roleCount} рол.`
      );
      await qc.invalidateQueries({ queryKey: ["access-role-defaults", tenantSlug] });
      invalidateMePermissionsQueries(qc, tenantSlug);
    },
    onError: (err: unknown) => {
      setOkMsg(null);
      setError(getUserFacingError(err, "Не удалось сохранить привязку."));
    }
  });

  const canBind = ops.size > 0 && roleIds.size > 0 && !bindMut.isPending;
  const allVisibleOpsOn =
    visibleOpKeys.length > 0 && visibleOpKeys.every((k) => ops.has(k));
  const someVisibleOpsOn = visibleOpKeys.some((k) => ops.has(k)) && !allVisibleOpsOn;
  const allGrantOn = ops.size > 0 && [...ops].every((k) => grantKeys.has(k));

  return (
    <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-card">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="mb-2 text-xs font-semibold">Роли</p>
          <Input
            className="h-8 text-xs"
            placeholder="Поиск роли"
            value={roleSearch}
            onChange={(e) => setRoleSearch(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline"
              onClick={() =>
                setRoleIds((prev) => {
                  const ids = filteredRoles.map((r) => r.id);
                  const all = ids.length > 0 && ids.every((id) => prev.has(id));
                  return all ? new Set() : new Set(ids);
                })
              }
            >
              {filteredRoles.length > 0 && filteredRoles.every((r) => roleIds.has(r.id))
                ? "Снять все"
                : "Выбрать все"}
            </button>
            <span className="tabular-nums">Выбрано: {roleIds.size}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
          {rolesLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Загрузка…</p>
          ) : (
            filteredRoles.map((r) => {
              const picked = roleIds.has(r.id);
              return (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    checked={picked}
                    onChange={(e) =>
                      setRoleIds((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.add(r.id);
                        else n.delete(r.id);
                        return n;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {accessRoleDisplayName(r.key, r.name)}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {r.operations_count}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-2 py-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={searching || groupIds.length === 0}
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(groupIds))}
          >
            {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
            {allExpanded ? "Свернуть" : "Развернуть"}
          </Button>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-[11px]"
              placeholder="Поиск операции"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-teal-700 hover:underline"
            disabled={visibleOpKeys.length === 0}
            onClick={() => setKeys(visibleOpKeys, !allVisibleOpsOn)}
          >
            {allVisibleOpsOn ? "Снять все" : someVisibleOpsOn ? "Выбрать видимые" : "Выбрать все"}
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground">{ops.size}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-1.5">
          <p className="text-[11px] text-muted-foreground">
            {selectedRoles.length === 1
              ? `Состав роли «${accessRoleDisplayName(selectedRoles[0].key, selectedRoles[0].name)}» — отметьте и прикрепите/открепите`
              : "Отметьте операции для выбранных ролей"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              {allGrantOn ? "Выдавать" : "Просмотр"}
            </span>
            <AccessCompactSwitch
              checked={allGrantOn}
              disabled={ops.size === 0}
              title={
                allGrantOn
                  ? "Отмеченные операции можно выдавать другим"
                  : "Отмеченные операции — только просмотр"
              }
              onChange={(next) =>
                setGrantKeys((prev) => {
                  const n = new Set(prev);
                  for (const k of ops) {
                    if (next) n.add(k);
                    else n.delete(k);
                  }
                  return n;
                })
              }
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {treeQ.isLoading ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Загрузка…</p>
          ) : visibleTree.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Ничего не найдено</p>
          ) : (
            <AccessRoleDefaultsOpPickTree
              tree={visibleTree}
              expanded={expanded}
              forceOpen={searching}
              isOn={(key) => ops.has(key)}
              onToggleOpen={(id) =>
                setExpanded((prev) => {
                  const n = new Set(prev);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              onToggleView={toggleViewDefault}
              onToggleKey={(key, next) => setKeys([key], next)}
            />
          )}
        </div>
        {error ? <p className="px-3 pb-2 text-xs text-destructive" role="alert">{error}</p> : null}
        {okMsg ? <p className="px-3 pb-2 text-xs text-teal-800 dark:text-teal-300" role="status">{okMsg}</p> : null}
        <div className="shrink-0 space-y-2 border-t border-border/70 bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            {canBind
              ? `Ролей: ${roleIds.size} · операций: ${ops.size}`
              : "Отметьте хотя бы одну роль слева и операции справа"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
              disabled={!canBind}
              onClick={() => void bindMut.mutateAsync("attach")}
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Прикрепить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 border-orange-600/50 text-orange-950 hover:bg-orange-500/10 dark:text-orange-100"
              disabled={!canBind}
              onClick={() => void bindMut.mutateAsync("detach")}
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden />
              Открепить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
