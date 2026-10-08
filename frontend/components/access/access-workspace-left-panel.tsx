"use client";

import { useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SideRow } from "./access-workspace.shared";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

function CompactSideRow({
  row,
  active,
  checked,
  selectMode,
  nested,
  onClick
}: {
  row: SideRow;
  active: boolean;
  checked: boolean;
  selectMode: boolean;
  nested?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      aria-pressed={selectMode ? checked : undefined}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-emerald-400/80 bg-emerald-50 dark:border-emerald-600/50 dark:bg-emerald-950/35"
          : checked
            ? "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/25"
            : "border-border/80 bg-card hover:bg-muted/30",
        !row.is_active && "opacity-60",
        nested && "ml-1"
      )}
    >
      {selectMode ? (
        <input type="checkbox" readOnly tabIndex={-1} checked={checked} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700" aria-hidden />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-foreground">{row.title}</span>
        {row.subtitle ? <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{row.subtitle}</span> : null}
      </span>
    </button>
  );
}

export function AccessWorkspaceLeftPanel({ ws }: { ws: UseAccessWorkspaceReturn }) {
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const exitSelect = () => {
    setSelectMode(false);
    setPicked(new Set());
  };
  const togglePick = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const visibleKeys = ws.filteredSideRows.map((r) => r.key);
  const allPicked = visibleKeys.length > 0 && visibleKeys.every((k) => picked.has(k));
  const openUsersForPicked = () => {
    const key = [...picked][0];
    if (!key) return;
    ws.selectSideRowKey(key);
    ws.setOpUsersModalOpen(true);
  };

  return (
        <div className="access-left-panel flex min-h-0 w-full flex-col gap-2 overflow-hidden p-2.5 lg:min-h-0 lg:w-[min(360px,100%)] lg:min-w-[320px] lg:max-w-[380px] lg:shrink-0">
          <div className="shrink-0 rounded-md border border-border/60 bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold text-foreground">Фильтр</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="access-filter-field-label">Статус</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-1" role="group" aria-label="Статус">
                  {(["active", "inactive"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={ws.status === s}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        ws.status === s ? "bg-teal-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => ws.setStatus(s)}
                    >
                      {s === "active" ? "Активные" : "Неактивные"}
                    </button>
                  ))}
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
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 hover:underline dark:text-teal-300"
                  onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
                >
                  <ListChecks className="h-3 w-3" aria-hidden />
                  {selectMode ? "Отмена" : "Массовый выбор"}
                </button>
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
            {selectMode ? (
              <div className="flex items-center justify-between border-b border-border/60 px-2 py-1 text-[10px]">
                <button
                  type="button"
                  className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                  onClick={() => setPicked(allPicked ? new Set() : new Set(visibleKeys))}
                >
                  {allPicked ? "Снять все" : "Выбрать все"}
                </button>
                <span className="tabular-nums text-muted-foreground">Выбрано: {picked.size}</span>
              </div>
            ) : null}
            <div className="scrollbar-none min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden overscroll-y-contain p-1.5 pr-0.5">
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
                    <div key={g.group} className="rounded-lg">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-muted/50 dark:text-slate-100"
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
                      <div className={groupExpanded ? "space-y-1.5 py-1 pl-1" : "hidden"}>
                        <div className="space-y-1.5">
                          {g.subgroups.map((sg) => {
                            const sameAsGroup = sg.subgroup === g.group;
                            const subgroupKey = `${g.group}|||${sg.subgroup}`;
                            const subgroupExpanded = sameAsGroup || (groupExpanded && ws.leftExpandedSubgroups.has(subgroupKey));
                            if (sameAsGroup) {
                              return (
                                <div key={subgroupKey} className="space-y-1">
                                  {sg.items.map((r) => (
                                    <CompactSideRow
                                      key={r.key}
                                      row={r}
                                      selectMode={selectMode}
                                      checked={picked.has(r.key)}
                                      active={!selectMode && ws.selectedKey === r.key}
                                      onClick={() => {
                                        if (selectMode) togglePick(r.key);
                                        else {
                                          ws.selectSideRowKey(r.key);
                                          ws.prefetchDimensionUsersForKey(r.key);
                                        }
                                      }}
                                    />
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div key={subgroupKey} className="space-y-1">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300"
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
                                <div className={subgroupExpanded ? "space-y-1.5" : "hidden"}>
                                  {sg.items.map((r) => (
                                    <CompactSideRow
                                      key={r.key}
                                      row={r}
                                      nested={ws.isNestedOperationRow(r)}
                                      selectMode={selectMode}
                                      checked={picked.has(r.key)}
                                      active={!selectMode && ws.selectedKey === r.key}
                                      onClick={() => {
                                        if (selectMode) togglePick(r.key);
                                        else {
                                          ws.selectSideRowKey(r.key);
                                          ws.prefetchDimensionUsersForKey(r.key);
                                        }
                                      }}
                                    />
                                  ))}
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
                  <CompactSideRow
                    key={r.key}
                    row={r}
                    selectMode={selectMode}
                    checked={picked.has(r.key)}
                    active={!selectMode && ws.selectedKey === r.key}
                    onClick={() => {
                      if (selectMode) togglePick(r.key);
                      else {
                        ws.selectSideRowKey(r.key);
                        ws.prefetchDimensionUsersForKey(r.key);
                      }
                    }}
                  />
                ))
              )}
            </div>
            {selectMode && picked.size > 0 ? (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-teal-50 px-2 py-1.5 text-[11px] dark:bg-teal-950/40">
                <span>
                  Выбрано: <b className="tabular-nums">{picked.size}</b>
                </span>
                <Button type="button" size="sm" className="h-7 bg-teal-700 px-2 text-[11px] text-white hover:bg-teal-800" onClick={openUsersForPicked}>
                  Пользователи…
                </Button>
              </div>
            ) : null}
          </div>
        </div>
  );
}
