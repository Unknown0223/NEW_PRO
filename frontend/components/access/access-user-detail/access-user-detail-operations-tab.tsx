"use client";

import { Fragment } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Plus } from "lucide-react";
import { AccessBulkBottomBar } from "@/components/access/access-bulk-bottom-bar";
import { Button } from "@/components/ui/button";
import { TableSortButton } from "@/components/ui/table-sort-button";
import { cn } from "@/lib/utils";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { permissionSourceLabel } from "@/lib/access-user-permission-matrix";
import { shortenPathLabel, type MatrixSortKey } from "./access-user-detail.types";
import type { PermissionSourceFilter } from "@/lib/access-user-permission-matrix";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";
import { IndeterminateCheckbox } from "./access-user-detail-territory-ui";

export function AccessUserDetailOperationsTab({ vm }: { vm: AccessUserDetailVm }) {
  const {
    inner,
    userAccountControls,
    userId,
    openModal,
    matrixRowGroups,
    matrixGroupsAllExpanded,
    toggleMatrixGroupsExpandCollapse,
    filterParentDraft,
    setFilterParentDraft,
    filterSourceDraft,
    setFilterSourceDraft,
    setFilterParent,
    setFilterSource,
    parentOptions,
    bulkFeedback,
    bulkSel,
    setBulkSel,
    bulkSelectableKeys,
    bulkHeaderCheckboxRef,
    bulkHeaderAllSelected,
    toggleBulkAll,
    matrixHeadScrollRef,
    matrixBodyScrollRef,
    onMatrixHeadScroll,
    onMatrixBodyScroll,
    matrixSort,
    toggleMatrixSort,
    grantHeaderSwitchRef,
    grantHeaderAllOn,
    bulkApplyGrantDelegation,
    tableMatrix,
    matrixGroupExpanded,
    setMatrixGroupExpanded,
    isRowBulkSelectable,
    toggleBulkGroup,
    patchMut,
    toggleRowGrantDelegation,
    selectedDetachableCount,
    bulkApplyFilteredEffective,
    bulkDetach
  } = vm;

  if (inner !== "operations") return null;

  return (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="shrink-0 rounded-md border border-border/60 bg-card p-2 shadow-sm">
              <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
                  Показаны только операции, которые пользователь может выполнять. Базовые права — из роли;
                  дополнительные назначаются через «Добавить операции». Колонка «Предоставление доступа» —
                  может ли этот аккаунт выдавать каждую операцию другим (только для него, не через роль).
                  Снять саму операцию — «Открепить» / «Снять».
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 shrink-0 gap-1 bg-teal-700 px-2.5 text-[11px] text-white hover:bg-teal-800"
                  onClick={() => openModal("operations")}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Добавить операции
                </Button>
              </div>
              <p className="mb-1.5 text-xs font-semibold text-foreground">Фильтр</p>
              <div className="flex w-full flex-wrap items-end justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-2 gap-y-2">
                  <button
                    type="button"
                    title={
                      matrixGroupsAllExpanded
                        ? "Свернуть все группы в таблице"
                        : "Развернуть все группы в таблице"
                    }
                    aria-expanded={matrixGroupsAllExpanded}
                    disabled={matrixRowGroups.length === 0}
                    onClick={toggleMatrixGroupsExpandCollapse}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium shadow-sm transition-colors",
                      matrixRowGroups.length === 0 && "cursor-not-allowed opacity-50",
                      matrixGroupsAllExpanded
                        ? "border-teal-700/35 bg-teal-600 text-white hover:bg-teal-700"
                        : "border-sky-600/40 bg-sky-600 text-white hover:bg-sky-700"
                    )}
                  >
                    {matrixGroupsAllExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="max-sm:sr-only">{matrixGroupsAllExpanded ? "Свернуть" : "Развернуть"}</span>
                  </button>
                  <div className="min-w-0 sm:max-w-[min(100%,16rem)]">
                    <label htmlFor="access-page-filter-parent" className="sr-only">
                      Родитель
                    </label>
                    <select
                      id="access-page-filter-parent"
                      className="access-filter-select w-full max-w-[16rem]"
                      value={filterParentDraft}
                      onChange={(e) => setFilterParentDraft(e.target.value)}
                      title={
                        filterParentDraft.trim()
                          ? filterParentDraft
                          : "Родитель — без ограничения (все разделы)"
                      }
                    >
                      <option value="" title="Без ограничения по разделу">
                        Родитель
                      </option>
                      {parentOptions.map((opt) => (
                        <option key={opt} value={opt} title={opt}>
                          {shortenPathLabel(opt)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="shrink-0">
                    <label htmlFor="access-page-filter-source" className="sr-only">
                      Источник
                    </label>
                    <select
                      id="access-page-filter-source"
                      className="access-filter-select access-filter-select--fixed w-full min-w-[11rem] sm:w-auto"
                      value={filterSourceDraft}
                      onChange={(e) => setFilterSourceDraft(e.target.value as PermissionSourceFilter)}
                      title={
                        filterSourceDraft === "all"
                          ? "Источник — все активные"
                          : filterSourceDraft === "role"
                            ? "Только из роли (базовые)"
                            : "Только дополнительно назначенные"
                      }
                    >
                      <option value="all" title="Все активные операции">
                        Источник
                      </option>
                      <option value="role">Из роли</option>
                      <option value="extra">Дополнительно</option>
                    </select>
                  </div>
                </div>
                <div className="ml-auto flex shrink-0 flex-wrap items-end justify-end gap-1.5 self-end">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 bg-teal-700 px-3 text-[11px] text-white hover:bg-teal-800"
                    onClick={() => {
                      setFilterParent(filterParentDraft);
                      setFilterSource(filterSourceDraft);
                    }}
                  >
                    Применить
                  </Button>
                  {userAccountControls ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={userAccountControls.togglePending}
                        className={cn(
                          "h-7 px-2.5 text-[11px] font-medium text-white shadow-sm",
                          userAccountControls.isActive
                            ? "border-0 bg-amber-600 hover:bg-amber-700"
                            : "border-0 bg-emerald-600 hover:bg-emerald-700"
                        )}
                        onClick={() => void userAccountControls.onToggle()}
                      >
                        {userAccountControls.isActive ? "Отключить" : "Включить"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={userAccountControls.resetPending}
                        className="h-7 border-0 bg-rose-600 px-2.5 text-[11px] font-medium text-white shadow-sm hover:bg-rose-700"
                        onClick={() => void userAccountControls.onReset(userId)}
                      >
                        Сбросить
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {bulkFeedback ? (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "shrink-0 rounded-md border px-2 py-1 text-xs",
                  bulkFeedback.tone === "ok"
                    ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                )}
              >
                {bulkFeedback.text}
              </p>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="access-split-scroll-panel min-h-0 flex-1">
              {matrixRowGroups.length === 0 ? (
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-center">
                  <p className="max-w-md text-sm text-muted-foreground">
                    У пользователя пока нет активных операций — только базовые права роли или доступ ещё не назначен.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1 bg-teal-700 text-white hover:bg-teal-800"
                    onClick={() => openModal("operations")}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Добавить операции
                  </Button>
                </div>
              ) : (
              <>
              <div ref={matrixHeadScrollRef} className="access-split-scroll-head" onScroll={onMatrixHeadScroll}>
                <table className="access-matrix-table">
                  <colgroup>
                    <col className="w-8" />
                    <col className="min-w-[8rem]" />
                    <col className="min-w-[6rem] w-[10rem]" />
                    <col className="min-w-[8rem] w-[12rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <thead className="app-table-thead">
                    <tr>
                      <th scope="col" className="access-matrix-col-select py-1">
                        <span className="sr-only">Выбор строк для массовых действий</span>
                        <input
                          ref={bulkHeaderCheckboxRef}
                          type="checkbox"
                          className={`h-3.5 w-3.5 ${bulkSelectableKeys.length > 0 ? "accent-teal-700" : "cursor-not-allowed opacity-40"}`}
                          checked={bulkSelectableKeys.length > 0 ? bulkHeaderAllSelected : false}
                          disabled={patchMut.isPending || bulkSelectableKeys.length === 0}
                          onChange={(e) => toggleBulkAll(e.target.checked)}
                          title={
                            bulkSelectableKeys.length > 0
                              ? "Выбрать все видимые строки для массового включения/выключения или открепления"
                              : "Нет строк для массового выбора — включите «Доступ: управление» или выберите пользователя с активными операциями"
                          }
                          aria-label={
                            bulkSelectableKeys.length > 0
                              ? "Выбрать все видимые строки для массовых действий"
                              : "Нет строк для массового выбора"
                          }
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Описание"
                          active={matrixSort?.key === "description"}
                          dir={matrixSort?.key === "description" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("description")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Родитель"
                          active={matrixSort?.key === "parent"}
                          dir={matrixSort?.key === "parent" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("parent")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <TableSortButton
                          label="Раздел"
                          active={matrixSort?.key === "section"}
                          dir={matrixSort?.key === "section" ? matrixSort.dir : "asc"}
                          onClick={() => toggleMatrixSort("section")}
                        />
                      </th>
                      <th scope="col" className="px-2 py-1 text-left align-middle text-[10px] font-semibold leading-tight">
                        <span title="Роль — базовые права; Дополнительно — назначено вручную">Источник</span>
                      </th>
                      <th
                        scope="col"
                        className="w-[10rem] px-1.5 py-1 text-center align-middle text-[10px] font-semibold leading-tight"
                      >
                        <div className="flex flex-col items-center justify-center gap-1.5 py-0.5">
                          <span
                            className="w-full max-w-[10rem] px-0.5 text-center text-[9px] font-semibold leading-snug sm:text-[10px]"
                            title="Может выдавать эту операцию другим пользователям в «Доступ» (только для этого аккаунта)"
                          >
                            Предоставление доступа
                          </span>
                          {tableMatrix.length > 0 ? (
                            <label className="relative mx-auto flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                              <input
                                ref={grantHeaderSwitchRef}
                                type="checkbox"
                                role="switch"
                                aria-checked={grantHeaderAllOn}
                                className="peer sr-only"
                                checked={grantHeaderAllOn}
                                disabled={patchMut.isPending}
                                title={
                                  bulkSel.size > 0
                                    ? "Разрешить или запретить выдачу доступа другим — для выбранных операций"
                                    : "Разрешить или запретить выдачу доступа другим — для всех видимых операций"
                                }
                                onChange={(e) => void bulkApplyGrantDelegation(e.target.checked)}
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
                          ) : null}
                        </div>
                      </th>
                      <th scope="col" className="w-[8.5rem] px-2 py-1 text-center align-middle text-[10px] font-semibold leading-tight">
                        Действия
                      </th>
                    </tr>
                  </thead>
                </table>
              </div>
              <div ref={matrixBodyScrollRef} className="access-split-scroll-body" onScroll={onMatrixBodyScroll}>
                <table className="access-matrix-table">
                  <colgroup>
                    <col className="w-8" />
                    <col className="min-w-[8rem]" />
                    <col className="min-w-[6rem] w-[10rem]" />
                    <col className="min-w-[8rem] w-[12rem]" />
                    <col className="w-[7rem]" />
                    <col className="w-[10rem]" />
                    <col className="w-[8.5rem]" />
                  </colgroup>
                  <tbody>
                    {matrixRowGroups.map((grp) => {
                      const groupKey = grp.parent.trim() || "—";
                      const open = matrixGroupExpanded.has(groupKey);
                      const groupSelectableKeys = grp.rows.filter(isRowBulkSelectable).map((r) => r.key);
                      const groupAllSelected =
                        groupSelectableKeys.length > 0 && groupSelectableKeys.every((k) => bulkSel.has(k));
                      const groupSomeSelected =
                        groupSelectableKeys.length > 0 &&
                        groupSelectableKeys.some((k) => bulkSel.has(k)) &&
                        !groupAllSelected;
                      return (
                        <Fragment key={grp.parent}>
                          <tr className="border-t border-border/60 bg-muted/35">
                            <td className="access-matrix-col-select py-1 align-middle">
                              <div className="flex items-center justify-center px-0.5">
                                <IndeterminateCheckbox
                                  checked={groupAllSelected}
                                  indeterminate={groupSomeSelected}
                                  disabled={patchMut.isPending || groupSelectableKeys.length === 0}
                                  className="h-3.5 w-3.5"
                                  title={
                                    groupSelectableKeys.length === 0
                                      ? "В группе нет строк для массового выбора"
                                      : groupAllSelected
                                        ? "Снять выбор со всех строк группы"
                                        : "Выбрать все доступные строки группы"
                                  }
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleBulkGroup(grp, e.target.checked);
                                  }}
                                  aria-label={`Массовый выбор группы: ${shortenPathLabel(grp.parent)}`}
                                />
                              </div>
                            </td>
                            <td
                              colSpan={6}
                              className="cursor-pointer px-2 py-1"
                              onClick={() =>
                                setMatrixGroupExpanded((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(groupKey)) n.delete(groupKey);
                                  else n.add(groupKey);
                                  return n;
                                })
                              }
                            >
                              <div className="flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-[11px] font-semibold text-foreground hover:bg-muted/40">
                                {open ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                <span className="min-w-0 truncate" title={grp.parent}>
                                  {shortenPathLabel(grp.parent)}
                                </span>
                                <span className="shrink-0 font-normal text-muted-foreground">({grp.rows.length})</span>
                              </div>
                            </td>
                          </tr>
                          {open
                            ? grp.rows.map((row) => {
                                const rowSelectable = isRowBulkSelectable(row);
                                return (
                                <tr key={row.key} className="border-t border-border/50 transition-colors hover:bg-muted/25">
                                  <td className="access-matrix-col-select py-2">
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 ${rowSelectable ? "accent-teal-700" : "cursor-not-allowed opacity-45"}`}
                                      checked={rowSelectable ? bulkSel.has(row.key) : false}
                                      disabled={patchMut.isPending || !rowSelectable}
                                      title="Выбрать для массового запрета или открепления личной настройки"
                                      aria-label={
                                        rowSelectable
                                          ? `Выбрать строку: ${displayAccessDescriptionShort(row.description, row.key)}`
                                          : `Массовый выбор недоступен: ${displayAccessDescriptionShort(row.description, row.key)}`
                                      }
                                      onChange={(e) => {
                                        if (!rowSelectable) return;
                                        const n = new Set(bulkSel);
                                        if (e.target.checked) n.add(row.key);
                                        else n.delete(row.key);
                                        setBulkSel(n);
                                      }}
                                    />
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug"
                                    title={(row.description && row.description.trim()) || undefined}
                                  >
                                    {displayAccessDescriptionShort(row.description, row.key)}
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-muted-foreground"
                                    title={row.parent_path?.trim() || undefined}
                                  >
                                    {row.parent_path?.trim() || "—"}
                                  </td>
                                  <td
                                    className="min-w-0 break-words px-2 py-2 align-middle leading-snug text-muted-foreground"
                                    title={(row.section && row.section.trim()) || undefined}
                                  >
                                    {displayAccessDescriptionShort(row.section, "—")}
                                  </td>
                                  <td className="px-2 py-2 align-middle text-[11px]">
                                    <span
                                      className={cn(
                                        "inline-flex rounded px-1.5 py-0.5 font-medium",
                                        row.user_effect === "allow"
                                          ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                                          : "bg-muted/80 text-muted-foreground"
                                      )}
                                      title={
                                        row.user_effect === "allow"
                                          ? "Назначено дополнительно (не только роль)"
                                          : "Базовое право из роли пользователя"
                                      }
                                    >
                                      {permissionSourceLabel(row)}
                                    </span>
                                  </td>
                                  <td className="w-[10rem] px-2 py-2 text-center align-middle">
                                    <label className="relative mx-auto flex h-6 w-11 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                                      <input
                                        type="checkbox"
                                        role="switch"
                                        aria-checked={row.can_grant_others}
                                        aria-label={`${row.can_grant_others ? "Может выдавать другим" : "Не может выдавать другим"}: ${displayAccessDescriptionShort(row.description, row.key)}`}
                                        className="peer sr-only"
                                        checked={row.can_grant_others}
                                        disabled={patchMut.isPending}
                                        title={
                                          row.can_grant_others
                                            ? "Может выдавать эту операцию другим. Выключить — только право выдачи (сама операция остаётся)"
                                            : "Разрешить этому аккаунту выдавать эту операцию другим пользователям"
                                        }
                                        onChange={(e) => void toggleRowGrantDelegation(row, e.target.checked)}
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
                                  <td className="w-[8.5rem] px-2 py-2 text-center align-middle">
                                    {row.effective ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 min-w-[6.5rem] border-teal-600/45 px-2 text-[11px] text-teal-950 hover:bg-teal-500/10 dark:text-emerald-100"
                                        disabled={patchMut.isPending}
                                        title={
                                          row.user_effect !== "none"
                                            ? "Снять личную настройку (дополнительно назначенное)"
                                            : "Запретить для этого пользователя (роль не меняется)"
                                        }
                                        onClick={() => {
                                          if (row.user_effect !== "none") {
                                            void patchMut.mutateAsync({ remove_permission_keys: [row.key] });
                                            return;
                                          }
                                          void patchMut.mutateAsync({
                                            merge_permissions: true,
                                            denied_permissions: [row.key]
                                          });
                                        }}
                                      >
                                        {row.user_effect !== "none" ? "Открепить" : "Снять"}
                                      </Button>
                                    ) : (
                                      <span className="text-muted-foreground">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                              })
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
              )}
            </div>
            {bulkSel.size > 0 ? (
              <AccessBulkBottomBar
                variant="operations"
                selectedCount={bulkSel.size}
                totalVisibleCount={bulkSelectableKeys.length}
                onClear={() => setBulkSel(new Set())}
                busy={patchMut.isPending}
                denyTitle="Запретить выбранные операции (снять эффект)"
                onDeny={() => void bulkApplyFilteredEffective(false)}
                onDetach={() => void bulkDetach()}
                detachDisabled={selectedDetachableCount === 0}
                detachTitle={
                  selectedDetachableCount === 0
                    ? "Выберите активные операции для снятия доступа у этого пользователя"
                    : "Снять доступ у выбранных (личные — открепить, из роли — запретить только этому аккаунту)"
                }
                detachWithLinkIcon
              />
            ) : null}
            </div>
          </div>
  );
}
