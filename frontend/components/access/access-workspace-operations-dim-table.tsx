"use client";

import { TableSortButton } from "@/components/ui/table-sort-button";
import { Button } from "@/components/ui/button";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import { cn } from "@/lib/utils";
import { AccessDimUsersColGroup } from "./access-workspace.shared-ui";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

export function AccessWorkspaceOperationsDimTable({ ws }: { ws: UseAccessWorkspaceReturn }) {
  const bulkOpen = ws.opDimBulkSel.size > 0;
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-0 overflow-hidden",
        bulkOpen ? "flex-none justify-start" : "flex-1"
      )}
    >
      <div
        className={cn(
          "access-split-scroll-panel",
          bulkOpen ? "access-split-scroll-panel--compact" : "min-h-0 flex-1"
        )}
      >
        <div ref={ws.dimTableHeadScrollRef} className="access-split-scroll-head" onScroll={ws.onDimTableHeadScroll}>
          <table className="access-split-scroll-table">
            <AccessDimUsersColGroup />
            <thead className="app-table-thead">
              <tr>
                <th scope="col" className="access-matrix-col-select py-1">
                  <span className="sr-only">Выбор строк</span>
                  <input
                    ref={ws.opDimBulkHeaderCheckboxRef}
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-teal-700"
                    checked={ws.opDimBulkAllVisibleSelected}
                    disabled={
                      ws.filteredOperationUsers.length === 0 ||
                      ws.accessBulkSavePending ||
                      ws.operationAccessMut.isPending
                    }
                    onChange={(e) => ws.toggleOpDimSelectAllVisible(e.target.checked)}
                    title="Выбрать все видимые строки"
                    aria-label="Выбрать все видимые строки"
                  />
                </th>
                <th className="min-w-0 px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                  <TableSortButton
                    label="Имя пользователя"
                    active={ws.opDimUserSort?.key === "name"}
                    dir={ws.opDimUserSort?.key === "name" ? ws.opDimUserSort.dir : "asc"}
                    onClick={() => ws.toggleOpDimUserSort("name")}
                  />
                </th>
                <th className="w-20 px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                  <TableSortButton
                    label="Роль"
                    active={ws.opDimUserSort?.key === "role"}
                    dir={ws.opDimUserSort?.key === "role" ? ws.opDimUserSort.dir : "asc"}
                    onClick={() => ws.toggleOpDimUserSort("role")}
                  />
                </th>
                <th className="w-[5.5rem] px-1.5 py-0.5 text-left align-middle text-[10px] font-semibold leading-tight">
                  <TableSortButton
                    label="Должность"
                    active={ws.opDimUserSort?.key === "position"}
                    dir={ws.opDimUserSort?.key === "position" ? ws.opDimUserSort.dir : "asc"}
                    onClick={() => ws.toggleOpDimUserSort("position")}
                  />
                </th>
                <th className="w-16 px-1 py-0.5 text-center align-middle text-[10px] font-semibold leading-tight">
                  <TableSortButton
                    label="Статус"
                    active={ws.opDimUserSort?.key === "status"}
                    dir={ws.opDimUserSort?.key === "status" ? ws.opDimUserSort.dir : "asc"}
                    onClick={() => ws.toggleOpDimUserSort("status")}
                    align="center"
                    className="w-full"
                  />
                </th>
                <th
                  scope="col"
                  className="w-[5.25rem] px-1 py-0.5 text-center align-middle text-[10px] font-semibold leading-tight"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span
                      className="max-w-full text-center text-[8px] font-semibold leading-none"
                      title="Может выдавать операции другим пользователям в разделе «Доступ» (операция «Доступ: управление» / access.manage)"
                    >
                      Предоставление доступа
                    </span>
                    {ws.filteredOperationUsers.length > 0 ? (
                      <label className="relative flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                        <input
                          ref={ws.opDimGrantHeaderSwitchRef}
                          type="checkbox"
                          role="switch"
                          aria-checked={ws.opDimGrantHeaderAllOn}
                          className="peer sr-only"
                          checked={ws.opDimGrantHeaderAllOn}
                          disabled={ws.accessBulkSavePending || ws.operationAccessMut.isPending}
                          title={
                            ws.opDimBulkSel.size > 0
                              ? "Разрешить или запретить выдачу доступа другим — для выбранных"
                              : "Разрешить или запретить выдачу доступа другим — для всех видимых"
                          }
                          onChange={(e) => void ws.bulkApplyOpDimAccessManage(e.target.checked)}
                        />
                        <span
                          className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                          aria-hidden
                        />
                        <span
                          className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                          aria-hidden
                        />
                      </label>
                    ) : null}
                  </div>
                </th>
                <th className="w-20 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-tight">Действия</th>
              </tr>
            </thead>
          </table>
        </div>
        <div ref={ws.dimTableBodyScrollRef} className="access-split-scroll-body" onScroll={ws.onDimTableBodyScroll}>
          <table className="access-split-scroll-table">
            <AccessDimUsersColGroup />
            <tbody>
              {ws.opDimPadTop > 0 ? (
                <tr aria-hidden>
                  <td colSpan={7} style={{ height: ws.opDimPadTop, padding: 0, border: "none", lineHeight: 0 }} />
                </tr>
              ) : null}
              {ws.opDimVirtualItems.map((vi) => {
                const u = ws.displayOperationUsers[vi.index];
                if (!u) return null;
                const effective = ws.getOpEffective(u);
                const canGrant = Boolean(u.has_access_manage);
                const hasModuleView = Boolean(u.has_access_module_view);
                const rowOpAccessBusy = ws.opDimAccessBusyUserId === u.id;
                return (
                  <tr key={vi.key} className="border-t border-border/50" data-index={vi.index}>
                    <td className="access-matrix-col-select py-1.5 text-center align-middle">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-teal-700"
                        checked={ws.opDimBulkSel.has(u.id)}
                        disabled={ws.accessBulkSavePending}
                        onChange={(e) => {
                          ws.setOpDimBulkSel((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(u.id);
                            else n.delete(u.id);
                            return n;
                          });
                        }}
                        aria-label={`Выбрать: ${u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}`}
                      />
                    </td>
                    <td className="min-w-0 px-1.5 py-1.5 align-middle leading-snug">
                      {u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}
                    </td>
                    <td className="px-1.5 py-1.5 align-middle text-[11px]">{u.role}</td>
                    <td
                      className="truncate px-1.5 py-1.5 align-middle text-[11px] text-muted-foreground"
                      title={u.position || undefined}
                    >
                      {u.position || "—"}
                    </td>
                    <td className="px-1 py-1.5 text-center align-middle">
                      <span
                        className={
                          u.is_active
                            ? "inline-block rounded-md bg-emerald-600/15 px-1 py-0.5 text-[9px] font-medium text-emerald-800 dark:text-emerald-200"
                            : "inline-block rounded-md bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
                        }
                      >
                        {u.is_active ? "Активный" : "Неактивный"}
                      </span>
                    </td>
                    <td className="w-[5.25rem] px-1 py-1.5 text-center align-middle">
                      <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full">
                        <input
                          type="checkbox"
                          role="switch"
                          className="peer sr-only"
                          checked={canGrant}
                          disabled={ws.accessBulkSavePending || rowOpAccessBusy || (!canGrant && !hasModuleView)}
                          title={
                            !hasModuleView && !canGrant
                              ? "Сначала включите доступ к разделу «Доступ» (вкладка Пользователи → операции)"
                              : canGrant
                                ? "Запретить этому пользователю выдавать доступ другим"
                                : "Разрешить выдавать операции другим (только этому аккаунту)"
                          }
                          onChange={(e) => {
                            const body = ws.getAccessManagePatchBody(u, e.target.checked);
                            if (!body) return;
                            void ws.operationAccessMut.mutateAsync({ userId: u.id, body });
                          }}
                        />
                        <span
                          className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50"
                          aria-hidden
                        />
                        <span
                          className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform duration-200 ease-out peer-checked:translate-x-[1.25rem] peer-disabled:opacity-70"
                          aria-hidden
                        />
                      </label>
                    </td>
                    <td className="w-20 px-1 py-1.5 text-center align-middle">
                      {effective ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 min-w-0 border-orange-600/45 px-1.5 text-[10px] text-orange-950 hover:bg-orange-500/10 dark:text-orange-100"
                          disabled={ws.accessBulkSavePending || rowOpAccessBusy}
                          title={
                            u.from_direct_allow || u.from_direct_deny
                              ? "Снять личную настройку"
                              : "Запретить для этого пользователя (роль не меняется)"
                          }
                          onClick={() => {
                            const key = ws.selectedDimension!.key;
                            if (u.from_direct_allow || u.from_direct_deny) {
                              void ws.operationAccessMut.mutateAsync({
                                userId: u.id,
                                body: { remove_permission_keys: [key] }
                              });
                              return;
                            }
                            const body = ws.getOpPatchBodyForToggle(u, false, key);
                            if (body) void ws.operationAccessMut.mutateAsync({ userId: u.id, body });
                          }}
                        >
                          {u.from_direct_allow || u.from_direct_deny ? "Открепить" : "Снять"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {ws.opDimPadBot > 0 ? (
                <tr aria-hidden>
                  <td colSpan={7} style={{ height: ws.opDimPadBot, padding: 0, border: "none", lineHeight: 0 }} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {ws.opDimBulkSel.size > 0 ? (
        <AccessBulkBottomBar
          variant="operations"
          selectedCount={ws.opDimBulkSel.size}
          totalVisibleCount={ws.filteredOperationUsers.length}
          onClear={() => ws.setOpDimBulkSel(new Set())}
          busy={ws.accessBulkSavePending || ws.operationAccessMut.isPending}
          denyTitle="Запретить операцию для выбранных пользователей"
          onDeny={() => void ws.bulkApplyOpDimEffective(false)}
          onDetach={() => void ws.bulkDetachOpDimSelected()}
          detachDisabled={ws.opDimSelectedDetachableCount === 0}
          detachTitle={
            ws.opDimSelectedDetachableCount === 0
              ? "Выберите пользователей с активной операцией для снятия"
              : "Снять операцию у выбранных (личные — открепить, из роли — запретить только этому аккаунту)"
          }
        />
      ) : null}
    </div>
  );
}
