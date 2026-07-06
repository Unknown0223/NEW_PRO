"use client";

import { ChevronDown, ChevronRight, ChevronsDownUp, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  accessModalRoleGroupLabel,
  accessModalUserBranchLine,
  accessModalUserPrimaryLine,
  accessWorkspaceUserPickerModalTitle,
  type AccessUserRow,
} from "./access-workspace.shared";
import { IndeterminateCheckbox } from "./access-workspace.shared-ui";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

export function AccessWorkspaceUserPickerModal({ ws }: { ws: UseAccessWorkspaceReturn }) {
  return (
      <Dialog
        open={ws.opUsersModalOpen}
        onOpenChange={(open) => {
          ws.setOpUsersModalOpen(open);
          if (!open) {
            ws.setOpUsersModalSearch("");
            ws.setOpUsersModalShowSelected(false);
          }
        }}
      >
        <DialogContent
          showCloseButton
          overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
          className={cn(
            "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-4 shadow-lg sm:max-w-[min(48rem,calc(100vw-2rem))]"
          )}
        >
          <DialogHeader className="shrink-0 space-y-0 border-b border-border/80 pb-3 text-left">
            <div className="flex items-start justify-between gap-4 pr-8">
              <DialogTitle className="min-w-0 flex-1 break-words text-left text-base font-semibold leading-snug">
                {accessWorkspaceUserPickerModalTitle(ws.usersModalKind, ws.selectedDimension?.label)}
              </DialogTitle>
              <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                Выделено: {ws.opUsersModalSelected.size}
              </span>
            </div>
            <DialogDescription className="sr-only">
              {ws.usersModalKind === "operations"
                ? "Выбор пользователей и включение или отключение операции. Сохранение отправляет изменения одним запросом."
                : "Выбор сотрудников для привязки к объекту доступа. Сохранение отправляет изменения одним запросом."}
            </DialogDescription>
            <p className="pt-2 text-left text-xs leading-relaxed text-muted-foreground">
              {ws.usersModalKind === "operations"
                ? "Отметьте пользователей для выдачи или снятия операции. Изменения только для выбранных аккаунтов, роль не меняется."
                : "Отметьте сотрудников для привязки к объекту. Снятие галочки — только от этого объекта."}
            </p>
          </DialogHeader>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden pb-1 pt-2">
            {ws.modalGrantValidationError ? (
              <p className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                {ws.modalGrantValidationError}
              </p>
            ) : null}
            <p className="shrink-0 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-xs text-foreground">
              {ws.modalBulkSummaryText}
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1 text-xs"
                disabled={ws.modalRoleKeys.length === 0 || ws.allUsersForOperationModalQ.isLoading}
                onClick={() => {
                  if (ws.modalRoleKeys.length === 0) return;
                  if (ws.allModalGroupsExpanded) ws.setOpUsersModalExpandedRoles(new Set());
                  else ws.setOpUsersModalExpandedRoles(new Set(ws.modalRoleKeys));
                }}
              >
                <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {ws.allModalGroupsExpanded ? "Свернуть все" : "Развернуть все"}
              </Button>
              <div className="relative min-w-[10rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={ws.opUsersModalSearch}
                  onChange={(e) => ws.setOpUsersModalSearch(e.target.value)}
                  placeholder="Поиск"
                  className="h-8 w-full pl-8 text-xs"
                  aria-label="Поиск по сотрудникам"
                  disabled={ws.allUsersForOperationModalQ.isLoading}
                />
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
                <IndeterminateCheckbox
                  checked={ws.allVisibleModalSelected}
                  indeterminate={ws.allVisibleModalSomeSelected}
                  disabled={ws.allVisibleModalUserIds.length === 0 || ws.allUsersForOperationModalQ.isLoading}
                  aria-label="Выбрать всех видимых в списке"
                  onChange={(e) => ws.toggleModalSelectAllVisible(e.target.checked)}
                />
                Выбрать все
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                disabled={ws.allUsersForOperationModalQ.isLoading}
                onClick={() => ws.setOpUsersModalSelected(new Set())}
              >
                Сбросить выбор
              </Button>
            </div>
            <div className="scrollbar-none flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-muted/15">
              <div className="scrollbar-none max-h-[min(52vh,440px)] min-h-[220px] flex-1 overflow-auto p-2">
              {ws.allUsersForOperationModalQ.isLoading ? (
                <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                  <span>Загрузка пользователей…</span>
                </div>
              ) : ws.opModalRoleGroups.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {ws.opModalUsers.length ? "Никого не найдено по фильтру" : "Нет пользователей"}
                </p>
              ) : (
                <div className="space-y-0">
                  {ws.opModalRoleGroups.map((g: { role: string; users: AccessUserRow[] }) => {
                    const expanded = ws.opUsersModalExpandedRoles.has(g.role);
                    const allChecked = g.users.length > 0 && g.users.every((u) => ws.opUsersModalSelected.has(u.id));
                    const someChecked = g.users.some((u) => ws.opUsersModalSelected.has(u.id)) && !allChecked;
                    return (
                      <div key={g.role} className="border-b border-border/40 last:border-b-0">
                        <div className="flex items-center gap-0.5 py-1 pr-0.5">
                          <button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            onClick={() => ws.toggleModalRoleExpanded(g.role)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Свернуть группу" : "Развернуть группу"}
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <span className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
                            {accessModalRoleGroupLabel(g.role)}
                            <span className="ml-1 font-normal text-muted-foreground">({g.users.length})</span>
                          </span>
                          <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-0.5 text-xs text-muted-foreground">
                            <IndeterminateCheckbox
                              checked={allChecked}
                              indeterminate={someChecked}
                              disabled={g.users.length === 0 || ws.allUsersForOperationModalQ.isLoading}
                              aria-label={`Выбрать всех в группе ${accessModalRoleGroupLabel(g.role)}`}
                              onChange={(e) => ws.toggleModalSelectRole(g.role, e.target.checked)}
                            />
                            Выбрать все
                          </label>
                        </div>
                        {expanded ? (
                          <div className="ml-3 space-y-0 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                            {g.users.map((u: AccessUserRow) => {
                              const primary = accessModalUserPrimaryLine(u);
                              const branch = accessModalUserBranchLine(u);
                              return (
                                <label
                                  key={u.id}
                                  className="flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1"
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                    checked={ws.opUsersModalSelected.has(u.id)}
                                    onChange={(e) =>
                                      ws.setOpUsersModalSelected((prev) => {
                                        const n = new Set(prev);
                                        if (e.target.checked) n.add(u.id);
                                        else n.delete(u.id);
                                        return n;
                                      })
                                    }
                                  />
                                  <span className="min-w-0 text-sm leading-snug">
                                    <span className="font-medium text-foreground">{primary}</span>
                                    {branch ? (
                                      <span className="mt-0.5 block text-[11px] text-muted-foreground">— {branch}</span>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 flex flex-col-reverse gap-3 border-t border-border/80 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:mr-auto">
              <input
                type="checkbox"
                className="accent-teal-700"
                checked={ws.opUsersModalShowSelected}
                disabled={ws.allUsersForOperationModalQ.isLoading}
                onChange={(e) => ws.setOpUsersModalShowSelected(e.target.checked)}
              />
              Показать только выбранные
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={ws.operationAccessMut.isPending || ws.accessBulkSavePending}
                onClick={() => ws.setOpUsersModalOpen(false)}
              >
                Отменить
              </Button>
              <Button
                type="button"
                className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
                disabled={
                  ws.operationAccessMut.isPending ||
                  ws.accessBulkSavePending ||
                  !ws.selectedDimension ||
                  ws.modalBulkItems.length === 0 ||
                  Boolean(ws.modalGrantValidationError) ||
                  ws.allUsersForOperationModalQ.isLoading
                }
                title={
                  ws.modalGrantValidationError
                    ? ws.modalGrantValidationError
                    : ws.modalBulkItems.length === 0
                      ? "Нет отличий от текущих настроек"
                      : undefined
                }
                onClick={() => void ws.saveOperationUsersModal()}
              >
                {ws.operationAccessMut.isPending || ws.accessBulkSavePending ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Сохранение…
                  </>
                ) : ws.modalBulkItems.length > 0 ? (
                  `Сохранить (${ws.modalBulkItems.length})`
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
