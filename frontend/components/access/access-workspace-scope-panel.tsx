"use client";

import { Search } from "lucide-react";
import { TableSortButton } from "@/components/ui/table-sort-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import {
  ACCESS_FILTER_MULTI_SEARCH_MIN,
  ACCESS_MANAGE_KEY,
  OP_ACTIVITY_FILTER_ITEMS,
  OP_GRANT_FILTER_ITEMS,
  buildScopeDimensionPatchBody,
  formatAccessFilterTriggerSummary,
  type ScopeDimensionTab,
  type SideRow,
} from "./access-workspace.shared";
import { AccessDimUsersColGroup } from "./access-workspace.shared-ui";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

export function AccessWorkspaceScopePanel({ ws }: { ws: UseAccessWorkspaceReturn }) {
  return (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
                      <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                        <SearchableMultiSelectPanel<string>
                          label="Роль"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Роль: все"
                          triggerClassName="access-filter-select w-full"
                          items={ws.cashRoleFilterItems}
                          selected={ws.cashFilterRolesDraft}
                          onSelectedChange={ws.setCashFilterRolesDraft}
                          searchable={ws.cashRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={ws.cashRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск роли"
                          search={ws.cashRoleFilterSearch}
                          onSearchChange={ws.setCashRoleFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) ws.setCashRoleFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Роль: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет ролей в списке"
                        />
                        <SearchableMultiSelectPanel<string>
                          label="Должность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Должность: все"
                          triggerClassName="access-filter-select w-full"
                          items={ws.cashPositionFilterItems}
                          selected={ws.cashFilterPositionsDraft}
                          onSelectedChange={ws.setCashFilterPositionsDraft}
                          searchable={ws.cashPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          filterItemsBySearch={ws.cashPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
                          searchPlaceholder="Поиск должности"
                          search={ws.cashPosFilterSearch}
                          onSearchChange={ws.setCashPosFilterSearch}
                          onOpenChange={(o) => {
                            if (!o) ws.setCashPosFilterSearch("");
                          }}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Должность: все", sel, it)}
                          minPopoverWidth={260}
                          maxListHeightClass="max-h-56"
                          emptyMessage="Нет должностей в списке"
                        />
                        <div
                          className="access-filter-select flex w-full cursor-not-allowed items-center text-left text-muted-foreground opacity-70"
                          title="В этом списке только пользователи с прикреплением к выбранному объекту"
                          role="note"
                        >
                          Предоставление: прикреплённые
                        </div>
                        <SearchableMultiSelectPanel<string>
                          label="Активность"
                          hideOuterLabel
                          hidePopoverHeader
                          triggerPlaceholder="Активность: все"
                          triggerClassName="access-filter-select w-full"
                          items={OP_ACTIVITY_FILTER_ITEMS}
                          selected={ws.cashFilterActivitiesDraft}
                          onSelectedChange={ws.setCashFilterActivitiesDraft}
                          searchable={false}
                          resetAllLabel="Показать все"
                          formatTriggerSummary={(sel, it) =>
                            formatAccessFilterTriggerSummary("Активность: все", sel, it)
                          }
                          minPopoverWidth={220}
                          maxListHeightClass="max-h-40"
                        />
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            ws.setCashFilterRoles(new Set(ws.cashFilterRolesDraft));
                            ws.setCashFilterPositions(new Set(ws.cashFilterPositionsDraft));
                            ws.setCashFilterActivities(new Set(ws.cashFilterActivitiesDraft));
                          }}
                        >
                          Применить
                        </Button>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
                      <div className="relative min-w-0 max-w-sm flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Поиск"
                          value={ws.cashSearch}
                          onChange={(e) => ws.setCashSearch(e.target.value)}
                          className="h-8 pl-8 text-xs"
                        />
                      </div>
                      <div className="flex shrink-0 justify-end gap-2">
                        <Button size="sm" variant="outline" className="h-8 text-xs" type="button" disabled>
                          Настройки
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          type="button"
                          title="Кого прикрепить или открепить от выбранного объекта (касса, склад, филиал, способ оплаты, направление)"
                          onClick={() => {
                            ws.setUsersModalKind(ws.tab as ScopeDimensionTab);
                            ws.setOpUsersModalOpen(true);
                          }}
                        >
                          Пользователи
                        </Button>
                      </div>
                    </div>
                    {ws.scopeDimBulkFeedback ? (
                      <p
                        role="status"
                        className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
                          ws.scopeDimBulkFeedback.tone === "ok"
                            ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {ws.scopeDimBulkFeedback.text}
                      </p>
                    ) : null}
                    {ws.dimensionUsersQ.isLoading ? (
                      <p className="shrink-0 text-xs text-muted-foreground">Загрузка…</p>
                    ) : ws.filteredCashUsers.length === 0 ? (
                      <p className="shrink-0 text-xs text-muted-foreground">Никакой информации не найдено</p>
                    ) : (
                      <div
                        className={cn(
                          "flex min-h-0 flex-col gap-0 overflow-hidden",
                          ws.scopeDimBulkSel.size > 0 ? "flex-none justify-start" : "flex-1"
                        )}
                      >
                      <div
                        className={cn(
                          "access-split-scroll-panel",
                          ws.scopeDimBulkSel.size > 0 ? "access-split-scroll-panel--compact" : "min-h-0 flex-1"
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
                                    ref={ws.scopeDimBulkHeaderCheckboxRef}
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-teal-700"
                                    checked={ws.scopeDimBulkAllVisibleSelected}
                                    disabled={
                                      ws.filteredCashUsers.length === 0 ||
                                      ws.accessBulkSavePending ||
                                      ws.operationAccessMut.isPending ||
                                      ws.allUsersForOperationModalQ.isLoading
                                    }
                                    onChange={(e) => ws.toggleScopeDimSelectAllVisible(e.target.checked)}
                                    title="Выбрать все видимые строки"
                                    aria-label="Выбрать все видимые строки"
                                  />
                                </th>
                                <th className="min-w-0 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Имя пользователя"
                                    active={ws.scopeDimUserSort?.key === "name"}
                                    dir={ws.scopeDimUserSort?.key === "name" ? ws.scopeDimUserSort.dir : "asc"}
                                    onClick={() => ws.toggleScopeDimUserSort("name")}
                                  />
                                </th>
                                <th className="w-28 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Роль"
                                    active={ws.scopeDimUserSort?.key === "role"}
                                    dir={ws.scopeDimUserSort?.key === "role" ? ws.scopeDimUserSort.dir : "asc"}
                                    onClick={() => ws.toggleScopeDimUserSort("role")}
                                  />
                                </th>
                                <th className="w-32 px-2 py-1 text-left align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Должность"
                                    active={ws.scopeDimUserSort?.key === "position"}
                                    dir={ws.scopeDimUserSort?.key === "position" ? ws.scopeDimUserSort.dir : "asc"}
                                    onClick={() => ws.toggleScopeDimUserSort("position")}
                                  />
                                </th>
                                <th className="w-24 px-2 py-1 text-center align-middle text-xs font-semibold leading-tight whitespace-nowrap">
                                  <TableSortButton
                                    label="Статус"
                                    active={ws.scopeDimUserSort?.key === "status"}
                                    dir={ws.scopeDimUserSort?.key === "status" ? ws.scopeDimUserSort.dir : "asc"}
                                    onClick={() => ws.toggleScopeDimUserSort("status")}
                                    align="center"
                                    className="w-full"
                                  />
                                </th>
                                <th className="w-24 px-2 py-1 text-center text-xs font-semibold leading-tight whitespace-nowrap">Действия</th>
                              </tr>
                            </thead>
                          </table>
                        </div>
                        <div ref={ws.dimTableBodyScrollRef} className="access-split-scroll-body" onScroll={ws.onDimTableBodyScroll}>
                          <table className="access-split-scroll-table">
                            <AccessDimUsersColGroup />
                            <tbody>
                              {ws.scopeDimPadTop > 0 ? (
                                <tr aria-hidden>
                                  <td
                                    colSpan={6}
                                    style={{ height: ws.scopeDimPadTop, padding: 0, border: "none", lineHeight: 0 }}
                                  />
                                </tr>
                              ) : null}
                              {ws.scopeDimVirtualItems.map((vi) => {
                                const u = ws.displayCashUsers[vi.index];
                                if (!u) return null;
                                const full = ws.opModalUsersById.get(u.id);
                                const kind = ws.tab as ScopeDimensionTab;
                                const scopeRowHasAttachment =
                                  full && ws.selectedDimension
                                    ? buildScopeDimensionPatchBody(kind, ws.selectedDimension.key, full, false) !== null
                                    : false;
                                const scopeBusy =
                                  ws.accessBulkSavePending || ws.operationAccessMut.isPending || ws.allUsersForOperationModalQ.isLoading;
                                return (
                                  <tr key={vi.key} className="border-t border-border/50" data-index={vi.index}>
                                    <td className="access-matrix-col-select py-1.5 text-center align-middle">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 accent-teal-700"
                                        checked={ws.scopeDimBulkSel.has(u.id)}
                                        disabled={scopeBusy}
                                        onChange={(e) => {
                                          ws.setScopeDimBulkSel((prev) => {
                                            const n = new Set(prev);
                                            if (e.target.checked) n.add(u.id);
                                            else n.delete(u.id);
                                            return n;
                                          });
                                        }}
                                        aria-label={`Выбрать: ${u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}`}
                                      />
                                    </td>
                                    <td className="min-w-0 px-2 py-1.5 align-middle leading-snug">{u.code ? `[${u.code}] ${u.full_name || u.login}` : u.full_name || u.login}</td>
                                    <td className="px-2 py-1.5 align-middle text-[11px] whitespace-nowrap">{u.role}</td>
                                    <td className="truncate px-2 py-1.5 align-middle text-[11px] text-muted-foreground" title={u.position || undefined}>
                                      {u.position || "—"}
                                    </td>
                                    <td className="px-2 py-1.5 text-center align-middle">
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
                                    <td className="w-24 px-2 py-1.5 text-center align-middle">
                                      {scopeRowHasAttachment ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 min-w-0 border-orange-600/45 px-1.5 text-[10px] text-orange-950 hover:bg-orange-500/10 dark:text-orange-100"
                                          disabled={scopeBusy || !full}
                                          onClick={() => void ws.detachScopeUser(u)}
                                        >
                                          Открепить
                                        </Button>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {ws.scopeDimPadBot > 0 ? (
                                <tr aria-hidden>
                                  <td
                                    colSpan={6}
                                    style={{ height: ws.scopeDimPadBot, padding: 0, border: "none", lineHeight: 0 }}
                                  />
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {ws.scopeDimBulkSel.size > 0 ? (
                        <AccessBulkBottomBar
                          variant="scope"
                          selectedCount={ws.scopeDimBulkSel.size}
                          totalVisibleCount={ws.filteredCashUsers.length}
                          onClear={() => ws.setScopeDimBulkSel(new Set())}
                          busy={ws.accessBulkSavePending || ws.operationAccessMut.isPending || ws.allUsersForOperationModalQ.isLoading}
                          onDetach={() => void ws.bulkDetachScopeDimLinks()}
                        />
                      ) : null}
                    </div>
                    )}
                </div>
  );
}
