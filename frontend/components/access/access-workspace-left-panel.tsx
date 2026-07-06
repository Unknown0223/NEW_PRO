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

export function AccessWorkspaceLeftPanel({ ws }: { ws: UseAccessWorkspaceReturn }) {
  return (
        <div className="access-left-panel flex min-h-0 w-full flex-col gap-2 overflow-hidden p-2.5 lg:min-h-0 lg:w-[min(300px,100%)] lg:min-w-[260px] lg:max-w-[300px] lg:shrink-0">
          <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-foreground">Фильтр</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="access-filter-field-label">Статус</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    data-active={status === "active"}
                    className={`access-ws.status-pill flex-1 ${status === "active" ? "" : "text-muted-foreground hover:bg-muted/40"}`}
                    onClick={() => ws.setStatus("active")}
                  >
                    Активные
                  </button>
                  <button
                    type="button"
                    data-active={status === "inactive"}
                    className={`access-ws.status-pill flex-1 ${status === "inactive" ? "" : "text-muted-foreground hover:bg-muted/40"}`}
                    onClick={() => ws.setStatus("inactive")}
                  >
                    Неактивные
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="access-filter-field-label">Поиск</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Название, логин, код…"
                    value={ws.search}
                    onChange={(e) => ws.setSearch(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-card shadow-sm">
            <div className="access-list-cap flex flex-wrap items-center justify-between gap-2">
              <span>{ws.activeTabLabel}</span>
              <div className="flex items-center gap-2">
                {(ws.tab === "users" || ws.tab === "operations") ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      if (ws.leftExpandedGroups.size > 0) ws.setLeftExpandedGroups(new Set());
                      else ws.setLeftExpandedGroups(new Set(ws.groupedFilteredSideRows.map((g) => g.group)));
                    }}
                  >
                    {ws.leftExpandedGroups.size > 0 ? "Свернуть" : "Развернуть"}
                  </Button>
                ) : null}
                <span className="font-normal tabular-nums text-muted-foreground">{ws.filteredSideRows.length}</span>
              </div>
            </div>
            <div className="scrollbar-none min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden overscroll-contain p-1.5 pr-0.5">
              {(ws.tab === "users" && ws.usersQ.isLoading) || (ws.tab !== "users" && ws.dimensionsQ.isLoading) ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">Загрузка…</p>
              ) : ws.filteredSideRows.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">Ничего не найдено</p>
              ) : ws.tab === "users" ? (
                ws.groupedFilteredSideRows.map((g: { group: string; items: SideRow[] }) => {
                  const expanded = ws.leftExpandedGroups.has(g.group);
                  return (
                    <div key={g.group} className="rounded-md border border-border/50">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs"
                        onClick={() =>
                          ws.setLeftExpandedGroups((prev) => {
                            if (prev.has(g.group)) return new Set();
                            return new Set([g.group]);
                          })
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted-foreground">{expanded ? "▾" : "▸"}</span>
                          <span className="font-medium">{g.group}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">{g.items.length}</span>
                      </button>
                      <div
                        className={`border-t border-border/50 transition-all duration-200 ease-out ${
                          expanded ? "p-1.5 opacity-100" : "hidden p-0 opacity-0"
                        }`}
                      >
                        <div className="space-y-2">
                          <div>
                            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Активные</div>
                            <div className="space-y-1">
                              {g.items.filter((r) => r.is_active).map((r: SideRow) => (
                                <button
                                  key={r.key}
                                  type="button"
                                  onClick={() => ws.selectSideRowKey(r.key)}
                                  onPointerEnter={() => ws.prefetchDimensionUsersForKey(r.key)}
                                  data-active={ws.selectedKey === r.key}
                                  className={cn(
                                    "access-item-card w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                                    ws.selectedKey === r.key
                                      ? ""
                                      : ws.isNestedOperationRow(r)
                                        ? "ml-2 border-l-2 border-l-sky-400/70 bg-sky-50/40 dark:bg-sky-900/10"
                                        : ""
                                  )}
                                >
                                  {r.idLine ? <div className="text-[11px] font-medium tabular-nums text-muted-foreground">{r.idLine}</div> : null}
                                  <div className="text-sm font-medium leading-snug">{r.title}</div>
                                  <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                  {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Неактивные</div>
                            <div className="space-y-1">
                              {g.items.filter((r) => !r.is_active).map((r: SideRow) => {
                                const fullUser = ws.rows.find((u) => String(u.id) === r.key);
                                const isSel = ws.selectedKey === r.key;
                                const toggleThisPending =
                                  ws.toggleMut.isPending && ws.toggleMut.variables?.id === Number(r.key);
                                return (
                                  <div
                                    key={r.key}
                                    data-active={isSel}
                                    className={cn(
                                      "w-full overflow-hidden rounded-md border px-2.5 py-2 shadow-sm transition-colors",
                                      isSel
                                        ? "border-rose-600 bg-rose-50 dark:border-rose-500 dark:bg-rose-950/50"
                                        : "border-rose-300/80 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/30"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => ws.selectSideRowKey(r.key)}
                                      className="w-full rounded-sm text-left outline-none ring-offset-background hover:opacity-95 focus-visible:ring-2 focus-visible:ring-rose-500/60"
                                    >
                                      {r.idLine ? (
                                        <div className="text-[11px] font-medium tabular-nums text-rose-900/80 dark:text-rose-200/90">
                                          {r.idLine}
                                        </div>
                                      ) : null}
                                      <div className="text-sm font-medium leading-snug text-rose-950 dark:text-rose-50">{r.title}</div>
                                      <div className="mt-0.5 text-[11px] text-rose-800/85 dark:text-rose-200/80">{r.subtitle}</div>
                                    </button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!fullUser || toggleThisPending}
                                      className="mt-2 h-8 w-full border-0 bg-emerald-600 text-[11px] text-white hover:bg-emerald-700"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (fullUser) void ws.toggleMut.mutateAsync(fullUser);
                                      }}
                                    >
                                      Включить
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : ws.tab === "operations" ? (
                ws.operationNestedGroups.map((g) => {
                  const groupExpanded = ws.leftExpandedGroups.has(g.group);
                  return (
                    <div key={g.group} className="rounded-md border border-border/80 bg-muted/40 dark:border-slate-700/80 dark:bg-slate-900/20">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200"
                        onClick={() =>
                          ws.setLeftExpandedGroups((prev) => {
                            if (prev.has(g.group)) return new Set();
                            return new Set([g.group]);
                          })
                        }
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-muted-foreground">{groupExpanded ? "▾" : "▸"}</span>
                          <span className="font-medium">{g.group}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {g.subgroups.reduce((acc, sg) => acc + sg.items.length, 0)}
                        </span>
                      </button>
                      <div className={groupExpanded ? "border-t border-border/70 p-1.5 dark:border-slate-700/70" : "hidden"}>
                        <div className="space-y-1.5">
                          {g.subgroups.map((sg) => {
                            const subgroupKey = `${g.group}|||${sg.subgroup}`;
                            const subgroupExpanded = groupExpanded && ws.leftExpandedSubgroups.has(subgroupKey);
                            return (
                              <div
                                key={subgroupKey}
                                className="rounded-md border border-indigo-300/70 bg-indigo-50/40 dark:border-indigo-800/70 dark:bg-indigo-950/20"
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-medium text-indigo-700 dark:text-indigo-200"
                                  onClick={() =>
                                    ws.setLeftExpandedSubgroups((prev) => {
                                      if (prev.has(subgroupKey)) return new Set();
                                      return new Set([subgroupKey]);
                                    })
                                  }
                                >
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="text-muted-foreground">{subgroupExpanded ? "▾" : "▸"}</span>
                                    <span className="font-medium">{sg.subgroup}</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">{sg.items.length}</span>
                                </button>
                                <div className={subgroupExpanded ? "border-t border-indigo-300/60 p-1.5 dark:border-indigo-800/60" : "hidden"}>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Активные</div>
                                      <div className="space-y-1">
                                        {sg.items.filter((r) => r.is_active).map((r) => (
                                          <button
                                            key={r.key}
                                            type="button"
                                            onClick={() => ws.selectSideRowKey(r.key)}
                                            onPointerEnter={() => ws.prefetchDimensionUsersForKey(r.key)}
                                            data-active={ws.selectedKey === r.key}
                                            className={cn(
                                              "access-item-card w-full px-3 py-2.5 text-left transition-colors",
                                              ws.selectedKey === r.key
                                                ? "hover:bg-muted/40"
                                                : "border border-emerald-300/70 bg-emerald-50/50 hover:bg-emerald-100/60 dark:border-emerald-800/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30",
                                              ws.isNestedOperationRow(r)
                                                ? ws.selectedKey === r.key
                                                  ? "ml-2 border-l-2 border-l-primary/65"
                                                  : "ml-2 border-l-2 border-l-emerald-500/80"
                                                : ""
                                            )}
                                          >
                                            <div className="text-sm font-medium leading-snug">{r.title}</div>
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                            {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Неактивные</div>
                                      <div className="space-y-1">
                                        {sg.items.filter((r) => !r.is_active).map((r) => (
                                          <button
                                            key={r.key}
                                            type="button"
                                            onClick={() => ws.selectSideRowKey(r.key)}
                                            onPointerEnter={() => ws.prefetchDimensionUsersForKey(r.key)}
                                            data-active={ws.selectedKey === r.key}
                                            className={cn(
                                              "access-item-card w-full px-3 py-2.5 text-left transition-colors",
                                              ws.selectedKey === r.key
                                                ? "hover:bg-muted/40"
                                                : "border border-rose-300/70 bg-rose-50/50 hover:bg-rose-100/60 dark:border-rose-800/70 dark:bg-rose-950/20 dark:hover:bg-rose-900/30",
                                              ws.isNestedOperationRow(r)
                                                ? ws.selectedKey === r.key
                                                  ? "ml-2 border-l-2 border-l-primary/65"
                                                  : "ml-2 border-l-2 border-l-rose-500/80"
                                                : ""
                                            )}
                                          >
                                            <div className="text-sm font-medium leading-snug">{r.title}</div>
                                            <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                                            {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                ws.filteredSideRows.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => ws.selectSideRowKey(r.key)}
                    onPointerEnter={() => ws.prefetchDimensionUsersForKey(r.key)}
                    data-active={ws.selectedKey === r.key}
                    className="access-item-card w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                  >
                    {r.idLine ? <div className="text-[11px] font-medium tabular-nums text-muted-foreground">{r.idLine}</div> : null}
                    <div className="text-sm font-medium leading-snug">{r.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{r.subtitle}</div>
                    {r.meta ? <div className="mt-1 text-[10px] text-muted-foreground/90">{r.meta}</div> : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
  );
}
