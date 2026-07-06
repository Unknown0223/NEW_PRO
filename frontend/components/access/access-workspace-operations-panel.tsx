"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import {
  ACCESS_FILTER_MULTI_SEARCH_MIN,
  OP_ACTIVITY_FILTER_ITEMS,
  OP_GRANT_FILTER_ITEMS,
  formatAccessFilterTriggerSummary,
} from "./access-workspace.shared";
import { AccessWorkspaceOperationsDimTable } from "./access-workspace-operations-dim-table";
import type { UseAccessWorkspaceReturn } from "./use-access-workspace";

export function AccessWorkspaceOperationsPanel({ ws }: { ws: UseAccessWorkspaceReturn }) {
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
            items={ws.operationRoleFilterItems}
            selected={ws.opFilterRolesDraft}
            onSelectedChange={ws.setOpFilterRolesDraft}
            searchable={ws.operationRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
            filterItemsBySearch={ws.operationRoleOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
            searchPlaceholder="Поиск роли"
            search={ws.opRoleFilterSearch}
            onSearchChange={ws.setOpRoleFilterSearch}
            onOpenChange={(o) => {
              if (!o) ws.setOpRoleFilterSearch("");
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
            items={ws.operationPositionFilterItems}
            selected={ws.opFilterPositionsDraft}
            onSelectedChange={ws.setOpFilterPositionsDraft}
            searchable={ws.operationPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
            filterItemsBySearch={ws.operationPositionOptions.length >= ACCESS_FILTER_MULTI_SEARCH_MIN}
            searchPlaceholder="Поиск должности"
            search={ws.opPosFilterSearch}
            onSearchChange={ws.setOpPosFilterSearch}
            onOpenChange={(o) => {
              if (!o) ws.setOpPosFilterSearch("");
            }}
            resetAllLabel="Показать все"
            formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Должность: все", sel, it)}
            minPopoverWidth={260}
            maxListHeightClass="max-h-56"
            emptyMessage="Нет должностей в списке"
          />
          <SearchableMultiSelectPanel<string>
            label="Предоставление доступа"
            hideOuterLabel
            hidePopoverHeader
            triggerPlaceholder="Предоставление: все"
            triggerClassName="access-filter-select w-full"
            items={OP_GRANT_FILTER_ITEMS}
            selected={ws.opFilterGrantsDraft}
            onSelectedChange={ws.setOpFilterGrantsDraft}
            searchable={false}
            resetAllLabel="Показать все"
            formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Предоставление: все", sel, it)}
            minPopoverWidth={240}
            maxListHeightClass="max-h-40"
          />
          <SearchableMultiSelectPanel<string>
            label="Активность"
            hideOuterLabel
            hidePopoverHeader
            triggerPlaceholder="Активность: все"
            triggerClassName="access-filter-select w-full"
            items={OP_ACTIVITY_FILTER_ITEMS}
            selected={ws.opFilterActivitiesDraft}
            onSelectedChange={ws.setOpFilterActivitiesDraft}
            searchable={false}
            resetAllLabel="Показать все"
            formatTriggerSummary={(sel, it) => formatAccessFilterTriggerSummary("Активность: все", sel, it)}
            minPopoverWidth={220}
            maxListHeightClass="max-h-40"
          />
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              ws.setOpFilterRoles(new Set(ws.opFilterRolesDraft));
              ws.setOpFilterPositions(new Set(ws.opFilterPositionsDraft));
              ws.setOpFilterGrants(new Set(ws.opFilterGrantsDraft));
              ws.setOpFilterActivities(new Set(ws.opFilterActivitiesDraft));
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
            value={ws.opSearch}
            onChange={(e) => ws.setOpSearch(e.target.value)}
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
            title="Кого включить или исключить из доступа к выбранной операции"
            onClick={() => {
              ws.setUsersModalKind("operations");
              ws.setOpUsersModalOpen(true);
            }}
          >
            Пользователи
          </Button>
        </div>
      </div>
      {ws.opDimBulkFeedback ? (
        <p
          role="status"
          className={`shrink-0 rounded-md border px-2 py-1 text-xs ${
            ws.opDimBulkFeedback.tone === "ok"
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {ws.opDimBulkFeedback.text}
        </p>
      ) : null}
      {ws.dimensionUsersQ.isLoading ? (
        <p className="shrink-0 text-xs text-muted-foreground">Загрузка…</p>
      ) : ws.filteredOperationUsers.length === 0 ? (
        <p className="shrink-0 text-xs text-muted-foreground">Никакой информации не найдено</p>
      ) : (
        <AccessWorkspaceOperationsDimTable ws={ws} />
      )}
    </div>
  );
}
