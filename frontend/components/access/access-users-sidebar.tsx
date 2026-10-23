"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Link2, ListChecks, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { cn } from "@/lib/utils";
import { accessRoleLabel } from "@/lib/access-role-label";
import { formatOpsCount } from "@/lib/access-history-summary";
import { useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { AccessUsersBulkOpsDialog } from "./access-users-bulk-ops-dialog";
import type { AccessUserRow } from "./access-workspace.shared";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

type ManageFilter = "all" | "yes" | "no";

export function filterAccessUsers(
  rows: readonly AccessUserRow[],
  f: { status: "all" | "active" | "inactive"; role: string; manage: ManageFilter }
): AccessUserRow[] {
  return rows.filter(
    (r) =>
      (f.status === "all" || r.status === f.status) &&
      (!f.role || r.role === f.role) &&
      (f.manage === "all" || Boolean(r.has_access_manage) === (f.manage === "yes"))
  );
}

/** «Пользователи»: Активные / Неактивные, qidiruv, kartochkalar va ommaviy tanlash. */
export function AccessUsersSidebar({
  ws,
  selectedId,
  onSelect
}: {
  ws: UseAccessWorkspaceReturn;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [role, setRole] = useState("");
  const [manage, setManage] = useState<ManageFilter>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const toast = useAccessToast();
  const qc = useQueryClient();

  const roles = useMemo(
    () => [...new Set(ws.rows.map((r) => r.role))].sort((a, b) => accessRoleLabel(a).localeCompare(accessRoleLabel(b), "ru")),
    [ws.rows]
  );
  const counts = useMemo(() => {
    let active = 0;
    for (const r of ws.rows) if (r.status === "active") active++;
    return { active, inactive: ws.rows.length - active };
  }, [ws.rows]);
  const rows = useMemo(() => filterAccessUsers(ws.rows, { status: ws.status, role, manage }), [ws.rows, ws.status, role, manage]);

  const toggleSel = (id: number) =>
    setSel((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  const exitSelect = () => {
    setSelectMode(false);
    setSel(new Set());
  };
  const allVisibleSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <aside className="access-users-sidebar flex min-h-0 w-full shrink-0 flex-col rounded-xl border border-border/70 bg-card lg:w-[19rem]" aria-label="Пользователи">
      <div className="shrink-0 space-y-2 border-b border-border/60 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1" role="tablist" aria-label="Статус пользователей">
          {(["active", "inactive"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={ws.status === s}
              onClick={() => {
                ws.setStatus(s);
                setSel(new Set());
              }}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                ws.status === s ? "bg-teal-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "active" ? "Активные" : "Неактивные"}
              <span className="ml-1 tabular-nums opacity-75">{s === "active" ? counts.active : counts.inactive}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Поиск: логин, имя, код"
            value={ws.search}
            onChange={(e) => ws.setSearch(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs"
            aria-label="Поиск пользователей"
          />
          {ws.search ? (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => ws.setSearch("")}
              aria-label="Очистить поиск"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <select className="access-filter-select h-8 w-full text-xs" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Роль">
            <option value="">Все роли</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {accessRoleLabel(r)}
              </option>
            ))}
          </select>
          <select
            className="access-filter-select h-8 w-full text-xs"
            value={manage}
            onChange={(e) => setManage(e.target.value as ManageFilter)}
            aria-label="Предоставление доступа"
          >
            <option value="all">Доступ: все</option>
            <option value="yes">Может выдавать</option>
            <option value="no">Не выдаёт</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            Найдено: <b className="tabular-nums text-foreground">{rows.length}</b>
          </span>
          {selectMode ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                onClick={() => setSel(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)))}
              >
                {allVisibleSelected ? "Снять все" : "Выбрать все"}
              </button>
              <button type="button" className="hover:text-foreground" onClick={exitSelect}>
                Отмена
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline dark:text-teal-300"
              onClick={() => setSelectMode(true)}
              title="Выбрать несколько пользователей для массовой выдачи или запрета операций"
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden />
              Массовый выбор
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
        {ws.usersQ.isError ? (
          <PageError message="Не удалось загрузить пользователей." onRetry={() => void ws.usersQ.refetch()} />
        ) : ws.usersQ.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Загрузка пользователей">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs text-muted-foreground">Пользователи не найдены</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => {
              const active = !selectMode && r.id === selectedId;
              const checked = sel.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-pressed={selectMode ? checked : undefined}
                    onClick={() => (selectMode ? toggleSel(r.id) : onSelect(r.id))}
                    className={cn(
                      "group w-full rounded-lg border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-teal-600/60 bg-teal-50 dark:border-teal-500/50 dark:bg-teal-950/40"
                        : checked
                          ? "border-teal-500/50 bg-teal-50/60 dark:bg-teal-950/25"
                          : "border-border/70 hover:border-border hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {selectMode ? (
                        <input
                          type="checkbox"
                          readOnly
                          tabIndex={-1}
                          checked={checked}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                          aria-hidden
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-teal-700 dark:text-teal-300">{r.login}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.code ? `[${r.code}] ` : ""}
                          {r.full_name || "—"}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10.5px] text-foreground/80">
                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
                        {accessRoleLabel(r.role)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10.5px] tabular-nums text-foreground/80">
                        <Link2 className="h-3 w-3 text-muted-foreground" aria-hidden />
                        {formatOpsCount(r.operations_count)}
                      </span>
                      {r.has_access_manage ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10.5px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200"
                          title="Может выдавать доступ другим пользователям"
                        >
                          <KeyRound className="h-3 w-3" aria-hidden />
                          Выдаёт доступ
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectMode && sel.size > 0 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-teal-50 px-3 py-2 text-xs dark:bg-teal-950/40">
          <span>
            Выбрано: <b className="tabular-nums">{sel.size}</b>
          </span>
          <Button type="button" size="sm" className="h-7 bg-teal-700 text-xs text-white hover:bg-teal-800" onClick={() => setBulkOpen(true)}>
            Операции…
          </Button>
        </div>
      ) : null}

      <AccessUsersBulkOpsDialog
        tenantSlug={ws.tenantSlug}
        userIds={[...sel]}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onDone={(msg) => {
          toast.show({ tone: "ok", text: msg });
          exitSelect();
          void qc.invalidateQueries({ queryKey: ["access-users", ws.tenantSlug] });
        }}
      />
      {toast.node}
    </aside>
  );
}
