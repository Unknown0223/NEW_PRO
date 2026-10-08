"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Link2, Search, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { invalidateMePermissionsQueries } from "@/lib/me-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  accessOpKind,
  filterAccessTree,
  isFlatAccessModule,
  type AccessTreeModule,
  type AccessTreeOperation,
  type AccessTreeSection
} from "@/lib/access-operations-tree";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import { AccessCompactSwitch } from "@/components/access/access-compact-switch";

type RoleRow = {
  id: number;
  key: string;
  name: string;
  operations_count: number;
  permissions: string[];
};

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

  const tree = treeQ.data ?? [];
  const visibleTree = useMemo(() => filterAccessTree(tree, search), [tree, search]);
  const flatIds = useMemo(() => new Set(tree.filter(isFlatAccessModule).map((m) => m.id)), [tree]);
  const groupIds = useMemo(
    () => visibleTree.flatMap((m) => [m.id, ...(flatIds.has(m.id) ? [] : m.sections.map((s) => s.id))]),
    [visibleTree, flatIds]
  );
  const allExpanded = groupIds.length > 0 && groupIds.every((id) => expanded.has(id));
  const searching = search.trim().length > 0;

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => `${r.name} ${r.key}`.toLowerCase().includes(q));
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
  const viewKeysOf = (opsList: AccessTreeOperation[]) => opsList.filter((o) => accessOpKind(o.action) === "view").map((o) => o.key);
  const toggleViewDefault = (all: AccessTreeOperation[], next: boolean) => {
    if (!next) setKeys(all.map((o) => o.key), false);
    else setKeys(viewKeysOf(all), true);
  };

  const bindMut = useMutation({
    mutationFn: async (action: "attach" | "detach") => {
      await api.post(`/api/${tenantSlug}/access/role-defaults/bind`, {
        action,
        operation_keys: [...ops],
        role_ids: [...roleIds],
        role_grants:
          action === "attach"
            ? [...roleIds].map((id) => ({
                role_id: id,
                operation_keys: (roleGrant[id] ?? []).filter((k) => ops.has(k))
              }))
            : []
      });
    },
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ["access-role-defaults", tenantSlug] });
      invalidateMePermissionsQueries(qc, tenantSlug);
    },
    onError: (err: unknown) => setError(getUserFacingError(err, "Не удалось сохранить привязку."))
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
          <span className="text-[11px] tabular-nums text-muted-foreground">{ops.size}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {treeQ.isLoading ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Загрузка…</p>
          ) : visibleTree.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Ничего не найдено</p>
          ) : (
            <OpPickTree
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
                      aria-label={r.name || r.key}
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
                      <span className="min-w-0 flex-1 truncate font-medium">{r.name || r.key}</span>
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
                    <RoleGrantBranch
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
        {error ? <p className="px-3 pb-2 text-xs text-destructive">{error}</p> : null}
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

function OpPickTree({
  tree,
  expanded,
  forceOpen,
  isOn,
  onToggleOpen,
  onToggleView,
  onToggleKey
}: {
  tree: AccessTreeModule[];
  expanded: ReadonlySet<string>;
  forceOpen: boolean;
  isOn: (key: string) => boolean;
  onToggleOpen: (id: string) => void;
  onToggleView: (ops: AccessTreeOperation[], next: boolean) => void;
  onToggleKey: (key: string, next: boolean) => void;
}) {
  const open = (id: string) => forceOpen || expanded.has(id);
  const box = (ops: AccessTreeOperation[]) => {
    const keys = ops.map((o) => o.key);
    const on = keys.filter(isOn).length;
    return { keys, all: keys.length > 0 && on === keys.length, some: on > 0 && on < keys.length, ops };
  };
  const renderOps = (ops: AccessTreeOperation[]) =>
    ops.map((op) => (
      <label key={op.key} className="flex items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-muted/50">
        <input type="checkbox" className="h-3.5 w-3.5 accent-teal-700" checked={isOn(op.key)} onChange={(e) => onToggleKey(op.key, e.target.checked)} />
        <span className="min-w-0 flex-1 truncate">{op.label}</span>
      </label>
    ));
  const renderSection = (mod: AccessTreeModule, sec: AccessTreeSection) => {
    if (isFlatAccessModule(mod)) return <div key={sec.id}>{renderOps(sec.operations)}</div>;
    const st = box(sec.operations);
    const secOpen = open(sec.id);
    return (
      <div key={sec.id} className="ml-3">
        <div className="flex items-center gap-1.5 px-1 py-1">
          <button type="button" className="text-muted-foreground" onClick={() => onToggleOpen(sec.id)} aria-label={sec.label}>
            {secOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <IndeterminateCheckbox
            checked={st.all}
            indeterminate={st.some}
            className="h-3.5 w-3.5 accent-teal-700"
            onChange={() => onToggleView(sec.operations, st.some || st.all ? false : true)}
          />
          <button type="button" className="min-w-0 flex-1 truncate text-left text-[12px] font-medium" onClick={() => onToggleOpen(sec.id)}>
            {sec.label}
          </button>
        </div>
        {secOpen ? <div className="ml-4 border-l border-border/70 pl-1">{renderOps(sec.operations)}</div> : null}
      </div>
    );
  };
  return (
    <ul>
      {tree.map((mod) => {
        const allOps = mod.sections.flatMap((s) => s.operations);
        const st = box(allOps);
        const modOpen = open(mod.id);
        return (
          <li key={mod.id} className="border-b border-border/50">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button type="button" className="text-muted-foreground" onClick={() => onToggleOpen(mod.id)} aria-label={mod.label}>
                {modOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <IndeterminateCheckbox
                checked={st.all}
                indeterminate={st.some}
                className="h-3.5 w-3.5 accent-teal-700"
                onChange={() => onToggleView(allOps, st.some || st.all ? false : true)}
              />
              <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold" onClick={() => onToggleOpen(mod.id)}>
                {mod.label}
              </button>
              <span className="text-[10px] tabular-nums text-muted-foreground">{st.keys.filter(isOn).length || allOps.length}</span>
            </div>
            {modOpen ? <div className="pb-1">{mod.sections.map((sec) => renderSection(mod, sec))}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

function RoleGrantBranch({
  tree,
  grant,
  expanded,
  onToggleOpen,
  onGrant
}: {
  tree: AccessTreeModule[];
  grant: Set<string>;
  expanded: Set<string>;
  onToggleOpen: (id: string) => void;
  onGrant: (keys: string[], next: boolean) => void;
}) {
  if (tree.length === 0) return <p className="px-3 py-2 text-[11px] text-muted-foreground">Сначала отметьте операции слева</p>;
  const onCount = (keys: string[]) => keys.filter((k) => grant.has(k)).length;
  const allOn = (keys: string[]) => keys.length > 0 && onCount(keys) === keys.length;
  const hint = (keys: string[]) => {
    const n = onCount(keys);
    if (n === 0) return "Только просмотр";
    if (n === keys.length) return "Можно выдавать другим";
    return `Выдавать: ${n} из ${keys.length}`;
  };
  const Row = ({
    label,
    keys,
    open,
    onOpen,
    depth
  }: {
    label: string;
    keys: string[];
    open?: boolean;
    onOpen?: () => void;
    depth: number;
  }) => (
    <div
      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      {onOpen ? (
        <button type="button" className="mt-0.5 text-muted-foreground" onClick={onOpen} aria-label={label}>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-snug text-foreground">{label}</span>
        <span className="block text-[10.5px] leading-snug text-muted-foreground">{hint(keys)}</span>
      </span>
      <AccessCompactSwitch
        checked={allOn(keys)}
        title={hint(keys)}
        onChange={(next) => onGrant(keys, next)}
      />
    </div>
  );
  return (
    <div className="space-y-0.5 border-t border-border/60 bg-muted/20 px-1 py-1">
      {tree.map((mod) => {
        const keys = mod.sections.flatMap((s) => s.operations.map((o) => o.key));
        const open = expanded.has(mod.id);
        const flat = isFlatAccessModule(mod);
        return (
          <div key={mod.id}>
            <Row label={mod.label} keys={keys} open={open} onOpen={() => onToggleOpen(mod.id)} depth={0} />
            {open ? (
              flat ? (
                mod.sections.flatMap((s) => s.operations).map((op) => (
                  <Row key={op.key} label={op.label} keys={[op.key]} depth={1} />
                ))
              ) : (
                mod.sections.map((sec) => {
                  const sKeys = sec.operations.map((o) => o.key);
                  const secOpen = expanded.has(sec.id);
                  return (
                    <div key={sec.id}>
                      <Row label={sec.label} keys={sKeys} open={secOpen} onOpen={() => onToggleOpen(sec.id)} depth={1} />
                      {secOpen
                        ? sec.operations.map((op) => <Row key={op.key} label={op.label} keys={[op.key]} depth={2} />)
                        : null}
                    </div>
                  );
                })
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
