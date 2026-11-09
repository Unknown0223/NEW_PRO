"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Link2, Search, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
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
import { AccessRoleDefaultsRoleGrantBranch } from "@/components/access/access-role-defaults-role-grant-branch";

type RoleRow = {
  id: number;
  key: string;
  name: string;
  operations_count: number;
  permissions: string[];
};

/** «По операции»: operatsiyalarni massiv belgilash → rollarga bog‘lash. */
export function AccessRoleDefaultsByOperation({
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
  const [search, setSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [ops, setOps] = useState<Set<string>>(() => new Set());
  const [roleIds, setRoleIds] = useState<Set<number>>(() => new Set());
  const [roleGrant, setRoleGrant] = useState<Record<number, string[]>>({});
  const [openRoles, setOpenRoles] = useState<Set<number>>(() => new Set());
  const [roleExpanded, setRoleExpanded] = useState<Record<number, string[]>>({});
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
  const allVisibleOpsOn =
    visibleOpKeys.length > 0 && visibleOpKeys.every((k) => ops.has(k));
  const someVisibleOpsOn = visibleOpKeys.some((k) => ops.has(k)) && !allVisibleOpsOn;

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) =>
      `${accessRoleDisplayName(r.key, r.name)} ${r.name} ${r.key}`.toLowerCase().includes(q)
    );
  }, [roles, roleSearch]);

  const isOn = (key: string) => ops.has(key);
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
      const drop = new Set(keys);
      setRoleGrant((prev) => {
        const out: Record<number, string[]> = {};
        for (const [id, list] of Object.entries(prev)) out[Number(id)] = list.filter((k) => !drop.has(k));
        return out;
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
                operation_keys: (roleGrant[id] ?? []).filter((k) => ops.has(k))
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

  return (
    <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
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
            <Input className="h-7 pl-7 text-[11px]" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              isOn={isOn}
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
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border/60 bg-card">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="mb-2 text-xs font-semibold">Роли</p>
          <Input className="h-8 text-xs" placeholder="Поиск роли" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline"
              onClick={() =>
                setRoleIds((prev) => {
                  const ids = filteredRoles.map((r) => r.id);
                  const all = ids.every((id) => prev.has(id));
                  return all ? new Set() : new Set(ids);
                })
              }
            >
              {filteredRoles.length > 0 && filteredRoles.every((r) => roleIds.has(r.id)) ? "Снять все" : "Выбрать все"}
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
              const open = openRoles.has(r.id);
              const granted = new Set(roleGrant[r.id] ?? []);
              const pickedKeys = [...ops];
              const allGrant = pickedKeys.length > 0 && pickedKeys.every((k) => granted.has(k));
              const setGrant = (keys: string[], next: boolean) =>
                setRoleGrant((prev) => {
                  const cur = new Set(prev[r.id] ?? []);
                  for (const k of keys) {
                    if (next) cur.add(k);
                    else cur.delete(k);
                  }
                  return { ...prev, [r.id]: [...cur] };
                });
              const pickedTree = picked ? filterAccessTree(tree, "", (op) => ops.has(op.key)) : [];
              return (
                <div key={r.id} className="rounded-md border border-border/70">
                  <div className="flex items-center gap-2 px-2 py-1.5">
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
                      aria-label={accessRoleDisplayName(r.key, r.name)}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm"
                      onClick={() =>
                        setOpenRoles((prev) => {
                          const n = new Set(prev);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        })
                      }
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{accessRoleDisplayName(r.key, r.name)}</span>
                    </button>
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">
                      {allGrant ? "Выдавать" : "Просмотр"}
                    </span>
                    <AccessCompactSwitch
                      checked={allGrant}
                      disabled={!picked || pickedKeys.length === 0}
                      title={allGrant ? "Все отмеченные операции можно выдавать другим" : "Все отмеченные операции — только просмотр"}
                      onChange={(next) => setGrant(pickedKeys, next)}
                    />
                  </div>
                  {picked && open ? (
                    <AccessRoleDefaultsRoleGrantBranch
                      tree={pickedTree}
                      grant={granted}
                      expanded={new Set(roleExpanded[r.id] ?? [])}
                      onToggleOpen={(id) =>
                        setRoleExpanded((prev) => {
                          const cur = new Set(prev[r.id] ?? []);
                          if (cur.has(id)) cur.delete(id);
                          else cur.add(id);
                          return { ...prev, [r.id]: [...cur] };
                        })
                      }
                      onGrant={setGrant}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
        {error ? <p className="px-3 pb-2 text-xs text-destructive" role="alert">{error}</p> : null}
        {okMsg ? <p className="px-3 pb-2 text-xs text-teal-800 dark:text-teal-300" role="status">{okMsg}</p> : null}
        <div className="shrink-0 space-y-2 border-t border-border/70 bg-card px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            {canBind
              ? `Операций: ${ops.size} · ролей: ${roleIds.size}`
              : "Отметьте операции слева и хотя бы одну роль"}
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
