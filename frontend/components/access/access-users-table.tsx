"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { cn } from "@/lib/utils";
import { accessRoleLabel } from "@/lib/access-role-label";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import { useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { AccessUsersBulkOpsDialog } from "./access-users-bulk-ops-dialog";
import type { AccessUserRow } from "./access-workspace.shared";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

type Filters = { role: string; status: "all" | "active" | "inactive"; manage: "all" | "yes" | "no" };
const EMPTY: Filters = { role: "", status: "active", manage: "all" };

export function filterAccessUsers(rows: readonly AccessUserRow[], f: Filters): AccessUserRow[] {
  return rows.filter(
    (r) =>
      (!f.role || r.role === f.role) &&
      (f.status === "all" || r.status === f.status) &&
      (f.manage === "all" || Boolean(r.has_access_manage) === (f.manage === "yes"))
  );
}

/** «Пользователи»: jadval + filtrlar (Роль / Статус / Предоставление доступа) + ommaviy tanlash. */
export function AccessUsersTable({ ws, onOpenUser }: { ws: UseAccessWorkspaceReturn; onOpenUser: (id: number) => void }) {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const toast = useAccessToast();
  const qc = useQueryClient();

  const roles = useMemo(() => [...new Set(ws.rows.map((r) => r.role))].sort((a, b) => accessRoleLabel(a).localeCompare(accessRoleLabel(b), "ru")), [ws.rows]);
  const rows = useMemo(() => filterAccessUsers(ws.rows, applied), [ws.rows, applied]);
  const visibleIds = rows.map((r) => r.id);
  const selVisible = visibleIds.filter((id) => sel.has(id));
  const headState = selVisible.length === 0 ? "none" : selVisible.length === visibleIds.length ? "all" : "some";

  const filtersDirty = JSON.stringify(draft) !== JSON.stringify(applied);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="shrink-0 rounded-lg border border-border/60 bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="access-users-search" className="access-filter-field-label">
              Поиск
            </label>
            <Search className="pointer-events-none absolute bottom-2 left-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              id="access-users-search"
              placeholder="Логин, имя, код…"
              value={ws.search}
              onChange={(e) => ws.setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <div>
            <label htmlFor="access-users-role" className="access-filter-field-label">
              Роль
            </label>
            <select id="access-users-role" className="access-filter-select h-8 text-xs" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
              <option value="">Все роли</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {accessRoleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="access-users-status" className="access-filter-field-label">
              Статус
            </label>
            <select
              id="access-users-status"
              className="access-filter-select h-8 text-xs"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Filters["status"] })}
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
          </div>
          <div>
            <label htmlFor="access-users-manage" className="access-filter-field-label">
              Предоставление доступа
            </label>
            <select
              id="access-users-manage"
              className="access-filter-select h-8 text-xs"
              value={draft.manage}
              onChange={(e) => setDraft({ ...draft, manage: e.target.value as Filters["manage"] })}
            >
              <option value="all">Все</option>
              <option value="yes">Может выдавать доступ</option>
              <option value="no">Не может выдавать</option>
            </select>
          </div>
          <Button type="button" size="sm" className="h-8 bg-teal-700 text-white hover:bg-teal-800" disabled={!filtersDirty} onClick={() => setApplied(draft)}>
            Применить
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setDraft(EMPTY);
              setApplied(EMPTY);
              ws.setSearch("");
            }}
          >
            Сбросить
          </Button>
        </div>
      </div>

      {sel.size > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm dark:border-teal-800 dark:bg-teal-950/50">
          <span>
            Выбрано пользователей: <b className="tabular-nums">{sel.size}</b>
          </span>
          <Button type="button" size="sm" className="h-7 bg-teal-700 text-xs text-white hover:bg-teal-800" onClick={() => setBulkOpen(true)}>
            Операции…
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSel(new Set())}>
            Снять выделение
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-card">
        {ws.usersQ.isError ? (
          <PageError className="m-3" message="Не удалось загрузить пользователей." onRetry={() => void ws.usersQ.refetch()} />
        ) : ws.usersQ.isLoading ? (
          <div className="space-y-2 p-3" aria-busy="true" aria-label="Загрузка пользователей">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Пользователи не найдены</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-muted/80 text-xs text-muted-foreground backdrop-blur">
              <tr>
                <th scope="col" className="w-10 px-3 py-2">
                  <IndeterminateCheckbox
                    checked={headState === "all"}
                    indeterminate={headState === "some"}
                    onChange={() =>
                      setSel((prev) => {
                        const s = new Set(prev);
                        if (headState === "all") visibleIds.forEach((id) => s.delete(id));
                        else visibleIds.forEach((id) => s.add(id));
                        return s;
                      })
                    }
                    aria-label="Выбрать всех пользователей"
                    className="h-4 w-4 accent-teal-700"
                  />
                </th>
                <th scope="col" className="px-2 py-2 font-medium">Логин</th>
                <th scope="col" className="px-2 py-2 font-medium">Имя</th>
                <th scope="col" className="px-2 py-2 font-medium">Роль</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Операций</th>
                <th scope="col" className="px-2 py-2 font-medium">Предоставление доступа</th>
                <th scope="col" className="px-2 py-2 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-t border-border/50 hover:bg-muted/40 focus-within:bg-muted/40"
                  onClick={() => onOpenUser(r.id)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-700"
                      checked={sel.has(r.id)}
                      aria-label={`Выбрать ${r.login}`}
                      onChange={(e) =>
                        setSel((prev) => {
                          const s = new Set(prev);
                          if (e.target.checked) s.add(r.id);
                          else s.delete(r.id);
                          return s;
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="font-medium text-teal-800 underline-offset-2 hover:underline dark:text-teal-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUser(r.id);
                      }}
                    >
                      {r.login}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    {r.code ? <span className="text-muted-foreground">[{r.code}] </span> : null}
                    {r.full_name || "—"}
                  </td>
                  <td className="px-2 py-2">{accessRoleLabel(r.role)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{r.operations_count}</td>
                  <td className="px-2 py-2">
                    {r.has_access_manage ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        Может выдавать
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        r.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                      )}
                    >
                      {r.status === "active" ? "Активный" : "Неактивный"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        Показано: {rows.length} из {ws.rows.length}
      </p>
      <AccessUsersBulkOpsDialog
        tenantSlug={ws.tenantSlug}
        userIds={[...sel]}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onDone={(msg) => {
          toast.show({ tone: "ok", text: msg });
          setSel(new Set());
          void qc.invalidateQueries({ queryKey: ["access-users", ws.tenantSlug] });
        }}
      />
      {toast.node}
    </div>
  );
}
