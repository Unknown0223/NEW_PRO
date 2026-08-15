"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction
} from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  cloneRoleSets,
  toggleUserOneRoleColumn,
  type RolePickerColumn,
  type RolePickerUser
} from "./role-link-picker-grid";

type Pools = Record<string, RolePickerUser[] | undefined>;

function IndeterminateCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  className
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      checked={checked}
      onChange={onChange}
      className={cn("mt-0.5 h-4 w-4 shrink-0 accent-teal-700", className)}
    />
  );
}

function formatPickLine(u: RolePickerUser): string {
  const name = u.name.trim();
  const login = u.login.trim();
  if (name && login) return `${name} (${login})`;
  return name || login || `#${u.id}`;
}

/**
 * Shared attach-users picker — same shell as Доступ → Сотрудники
 * (accordion by role, search, «Показать только выбранные», Выделено).
 * Used by Касса, Склад, and Access Кассы/Склады scope tabs.
 */
export function RoleLinkUsersModal({
  open,
  onOpenChange,
  roleOrder,
  columns,
  pickers,
  local,
  setLocal,
  search,
  setSearch,
  onCancel,
  onDone,
  title = "Прикрепить пользователи",
  subtitle,
  doneLabel = "Готово",
  cancelLabel = "Отменить",
  donePending = false
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleOrder: string[];
  columns: RolePickerColumn[];
  pickers: Pools | undefined;
  local: Record<string, Set<number>>;
  setLocal: Dispatch<SetStateAction<Record<string, Set<number>>>>;
  search: string;
  setSearch: (q: string) => void;
  onCancel: () => void;
  onDone: () => void;
  title?: string;
  subtitle?: string;
  doneLabel?: string;
  cancelLabel?: string;
  donePending?: boolean;
}) {
  const [showSelOnly, setShowSelOnly] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setShowSelOnly(false);
      return;
    }
    setExpandedRoles([...roleOrder]);
  }, [open, roleOrder]);

  const selectedCount = roleOrder.reduce((n, r) => n + (local[r]?.size ?? 0), 0);
  const q = search.trim().toLowerCase();
  const loading = !pickers;

  const groups = useMemo(() => {
    if (!pickers) return [];
    const match = (u: RolePickerUser) =>
      !q || u.name.toLowerCase().includes(q) || u.login.toLowerCase().includes(q);

    return columns
      .map((col) => {
        const pool = pickers[col.pool] ?? [];
        const setForRole = local[col.role] ?? new Set<number>();
        let users = pool.filter(match);
        if (showSelOnly) {
          users = users.filter((u) => setForRole.has(u.id));
        }
        return { col, users, setForRole };
      })
      .filter((g) => g.users.length > 0);
  }, [pickers, columns, local, q, showSelOnly]);

  const visiblePickIds = useMemo(() => {
    const out: { role: string; id: number }[] = [];
    for (const g of groups) {
      for (const u of g.users) out.push({ role: g.col.role, id: u.id });
    }
    return out;
  }, [groups]);

  const allVisibleSelected =
    visiblePickIds.length > 0 &&
    visiblePickIds.every(({ role, id }) => local[role]?.has(id));
  const someVisibleSelected =
    visiblePickIds.some(({ role, id }) => local[role]?.has(id)) && !allVisibleSelected;

  const allExpanded =
    groups.length > 0 && groups.every((g) => expandedRoles.includes(g.col.role));

  const toggleExpandCollapseAll = () => {
    if (allExpanded) setExpandedRoles([]);
    else setExpandedRoles(groups.map((g) => g.col.role));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-hidden shadow-lg",
          "z-[100] sm:max-w-[min(42rem,calc(100vw-2rem))]"
        )}
        showCloseButton
      >
        <DialogHeader className="space-y-0 border-b border-border/80 pb-3 text-left">
          <div className="flex items-start justify-between gap-4 pr-8">
            <DialogTitle className="min-w-0 flex-1 break-words text-left text-base font-semibold leading-snug">
              {subtitle ? (
                <>
                  {title}: {subtitle}
                </>
              ) : (
                title
              )}
            </DialogTitle>
            <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
              Выделено: {selectedCount}
            </span>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-2 pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 text-xs"
              disabled={loading || groups.length === 0 || donePending}
              onClick={toggleExpandCollapseAll}
            >
              <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {allExpanded ? "Свернуть все" : "Развернуть все"}
            </Button>
            <div className="relative min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск"
                className="h-8 w-full pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Поиск по сотрудникам"
                disabled={donePending}
              />
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
              <IndeterminateCheckbox
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={loading || donePending || visiblePickIds.length === 0}
                onChange={(e) => {
                  setLocal((prev) => {
                    let next = cloneRoleSets(roleOrder, prev);
                    if (e.target.checked) {
                      for (const { role, id } of visiblePickIds) {
                        next = toggleUserOneRoleColumn(roleOrder, next, role, id, true);
                      }
                    } else {
                      for (const { role, id } of visiblePickIds) {
                        next[role]?.delete(id);
                      }
                    }
                    return next;
                  });
                }}
              />
              Выбрать все видимые
            </label>
          </div>

          <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                <span>Загрузка пользователей…</span>
              </div>
            ) : groups.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {showSelOnly || q
                  ? "Никого не найдено по фильтру"
                  : "Нет пользователей"}
              </p>
            ) : (
              <div className="space-y-0">
                {groups.map(({ col, users, setForRole }) => {
                  const expanded = expandedRoles.includes(col.role);
                  const leafIds = users.map((u) => u.id);
                  const allIn = leafIds.length > 0 && leafIds.every((id) => setForRole.has(id));
                  const someIn = leafIds.some((id) => setForRole.has(id)) && !allIn;
                  return (
                    <div key={col.role} className="border-b border-border/40 last:border-b-0">
                      <div className="flex items-center gap-0.5 py-1 pr-0.5">
                        <button
                          type="button"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                          onClick={() =>
                            setExpandedRoles((prev) =>
                              prev.includes(col.role)
                                ? prev.filter((r) => r !== col.role)
                                : [...prev, col.role]
                            )
                          }
                          aria-expanded={expanded}
                          aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
                          {col.label}
                        </span>
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-0.5 text-xs text-muted-foreground">
                          <IndeterminateCheckbox
                            checked={allIn}
                            indeterminate={someIn}
                            disabled={donePending}
                            onChange={(e) => {
                              setLocal((prev) => {
                                let next = cloneRoleSets(roleOrder, prev);
                                if (e.target.checked) {
                                  for (const id of leafIds) {
                                    next = toggleUserOneRoleColumn(
                                      roleOrder,
                                      next,
                                      col.role,
                                      id,
                                      true
                                    );
                                  }
                                } else {
                                  for (const id of leafIds) next[col.role].delete(id);
                                }
                                return next;
                              });
                            }}
                          />
                          Выбрать все
                        </label>
                      </div>
                      {expanded ? (
                        <div className="ml-3 space-y-0 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                          {users.map((u) => (
                            <label
                              key={u.id}
                              className="flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                disabled={donePending}
                                checked={setForRole.has(u.id)}
                                onChange={(e) => {
                                  setLocal((prev) =>
                                    toggleUserOneRoleColumn(
                                      roleOrder,
                                      prev,
                                      col.role,
                                      u.id,
                                      e.target.checked
                                    )
                                  );
                                }}
                              />
                              <span className="min-w-0 text-sm leading-snug">
                                <span className="font-medium text-foreground">
                                  {formatPickLine(u)}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:mr-auto">
            <input
              type="checkbox"
              className="accent-teal-700"
              checked={showSelOnly}
              disabled={donePending}
              onChange={(e) => setShowSelOnly(e.target.checked)}
            />
            Показать только выбранные
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={donePending}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              className="bg-teal-700 text-white hover:bg-teal-800"
              disabled={donePending || loading}
              onClick={onDone}
            >
              {donePending ? "Сохранение…" : doneLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Shared role column defs for cash desk / warehouse link pickers. */
export const ENTITY_LINK_ROLE_ORDER = [
  "agent",
  "cashier",
  "manager",
  "operator",
  "storekeeper",
  "supervisor",
  "expeditor"
] as const;

/** Plural group labels — match Доступ → Сотрудники style. */
export const ENTITY_LINK_ROLE_LABELS: Record<string, string> = {
  agent: "Агенты",
  cashier: "Кассиры",
  manager: "Менеджеры",
  operator: "Операторы",
  storekeeper: "Склад",
  supervisor: "Супервайзеры",
  expeditor: "Экспедиторы"
};

export const ENTITY_LINK_ROLE_KEYS = [...ENTITY_LINK_ROLE_ORDER];

export const ENTITY_LINK_ROLE_COLUMNS: RolePickerColumn[] = [
  { role: "agent", label: ENTITY_LINK_ROLE_LABELS.agent, pool: "agents" },
  { role: "cashier", label: ENTITY_LINK_ROLE_LABELS.cashier, pool: "operators" },
  { role: "manager", label: ENTITY_LINK_ROLE_LABELS.manager, pool: "operators" },
  { role: "operator", label: ENTITY_LINK_ROLE_LABELS.operator, pool: "operators" },
  { role: "storekeeper", label: ENTITY_LINK_ROLE_LABELS.storekeeper, pool: "operators" },
  { role: "supervisor", label: ENTITY_LINK_ROLE_LABELS.supervisor, pool: "supervisors" },
  { role: "expeditor", label: ENTITY_LINK_ROLE_LABELS.expeditor, pool: "expeditors" }
];
