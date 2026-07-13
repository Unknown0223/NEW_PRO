"use client";

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
import { formatTerritoryAssigneeSubtitle, shortenPathLabel, staffRoleGroupLabel, formatStaffPickLine, territoryLeafNameOnly, territoryZoneLabel } from "./access-user-detail.types";
import { IndeterminateCheckbox, TerritoryReferenceTreeRows } from "./access-user-detail-territory-ui";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

export function AccessUserDetailModals({ vm }: { vm: AccessUserDetailVm }) {
  const {
    modal,
    setModal,
    assignPickModal,
    modalTitle,
    modalSel,
    setModalSel,
    user,
    patchMut,
    catalogQ,
    territoriesQ,
    dimQ,
    supervisorPickQ,
    modalSearch,
    setModalSearch,
    showSelOnly,
    setShowSelOnly,
    attachModalBaseItems,
    opAttachGroups,
    opAttachGroupKeys,
    allOpAttachGroupsExpanded,
    opAttachGroupExpanded,
    setOpAttachGroupExpanded,
    toggleOpAttachGroup,
    territoryCatalog,
    visibleTerritoryLeafKeys,
    useReferenceTerritoryTree,
    referenceTerritoryTree,
    territoryHierarchy,
    territoryExpanded,
    setTerritoryExpanded,
    territorySubExpanded,
    setTerritorySubExpanded,
    treeExpanded,
    setTreeExpanded,
    staffPickByRole,
    staffRoleExpanded,
    setStaffRoleExpanded,
    toggleExpandCollapseStaffRoles,
    allStaffGroupsInViewExpanded,
    staffPickBootstrapping,
    visibleStaffPickIds,
    filteredModalItems,
    dimPickModal,
    visibleDimPickKeys,
    dimPickAllSelected,
    dimPickSomeSelected,
    saveModal
  } = vm;

  return (
      <Dialog open={Boolean(modal)} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent
          overlayClassName={
            assignPickModal
              ? "z-[100] bg-black/45 supports-backdrop-filter:backdrop-blur-[2px]"
              : undefined
          }
          className={cn(
            "max-h-[90vh] overflow-hidden shadow-lg",
            assignPickModal
              ? "z-[101] sm:max-w-[min(42rem,calc(100vw-2rem))]"
              : modal === "operations"
                ? "sm:max-w-2xl"
                : "sm:max-w-lg"
          )}
          showCloseButton
        >
          {assignPickModal ? (
            <DialogHeader className="space-y-0 border-b border-border/80 pb-3 text-left">
              <div className="flex items-start justify-between gap-4 pr-8">
                <DialogTitle className="min-w-0 flex-1 break-words text-left text-base font-semibold leading-snug">
                  {modal === "territory" ? (
                    <>Прикрепить территории: {formatTerritoryAssigneeSubtitle(user!)}</>
                  ) : modal === "staff" ? (
                    <>Прикрепить пользователи: {formatTerritoryAssigneeSubtitle(user!)}</>
                  ) : modal === "cash" ? (
                    <>Прикрепить кассу: {formatTerritoryAssigneeSubtitle(user!)}</>
                  ) : modal === "warehouse" ? (
                    <>Прикрепить склад: {formatTerritoryAssigneeSubtitle(user!)}</>
                  ) : modal === "branch" ? (
                    <>Прикрепить филиал: {formatTerritoryAssigneeSubtitle(user!)}</>
                  ) : (
                    <>Прикрепить способ оплаты: {formatTerritoryAssigneeSubtitle(user!)}</>
                  )}
                </DialogTitle>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  Выделено: {modalSel.size}
                </span>
              </div>
            </DialogHeader>
          ) : (
            <DialogHeader className="space-y-0 border-b border-border/80 pb-3 text-left">
              <div className="flex items-start justify-between gap-4 pr-8">
                <DialogTitle className="text-left text-base font-semibold leading-snug">{modalTitle}</DialogTitle>
                <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  Выделено: {modalSel.size}
                </span>
              </div>
            </DialogHeader>
          )}

          {modal === "territory" ? (
            <div className="flex min-h-0 flex-col">
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {territoriesQ.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка территорий…</span>
                  </div>
                ) : !(territoryCatalog?.flat?.length ?? 0) ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Нет доступных территорий</p>
                ) : (
                  <>
                    <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-1 py-2">
                      <IndeterminateCheckbox
                        checked={
                          visibleTerritoryLeafKeys.length > 0 &&
                          visibleTerritoryLeafKeys.every((k) => modalSel.has(k))
                        }
                        indeterminate={
                          visibleTerritoryLeafKeys.some((k) => modalSel.has(k)) &&
                          !(
                            visibleTerritoryLeafKeys.length > 0 &&
                            visibleTerritoryLeafKeys.every((k) => modalSel.has(k))
                          )
                        }
                        disabled={
                          patchMut.isPending || territoriesQ.isLoading || visibleTerritoryLeafKeys.length === 0
                        }
                        onChange={(e) => {
                          const n = new Set(modalSel);
                          if (e.target.checked) {
                            for (const k of visibleTerritoryLeafKeys) n.add(k);
                          } else {
                            for (const k of visibleTerritoryLeafKeys) n.delete(k);
                          }
                          setModalSel(n);
                        }}
                      />
                      <span className="text-sm font-medium">Выбрать всё</span>
                    </label>
                    <div className="pt-1">
                      {useReferenceTerritoryTree ? (
                        <TerritoryReferenceTreeRows
                          nodes={referenceTerritoryTree}
                          depth={0}
                          treeExpanded={treeExpanded}
                          setTreeExpanded={setTreeExpanded}
                          modalSel={modalSel}
                          setModalSel={setModalSel}
                          territoryDisabled={patchMut.isPending || territoriesQ.isLoading}
                        />
                      ) : (
                      territoryHierarchy.map((g) => {
                        const expanded = territoryExpanded.has(g.group);
                        const groupLeafKeys = g.subgroups.flatMap((s) => s.items.map((r) => String(r.id)));
                        const allInGroup =
                          groupLeafKeys.length > 0 && groupLeafKeys.every((k) => modalSel.has(k));
                        const someInGroup =
                          groupLeafKeys.some((k) => modalSel.has(k)) && !allInGroup;
                        return (
                          <div key={g.group} className="border-b border-border/40 last:border-b-0">
                            <div className="flex items-center gap-0.5 py-1">
                              <button
                                type="button"
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                onClick={() =>
                                  setTerritoryExpanded((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(g.group)) next.delete(g.group);
                                    else next.add(g.group);
                                    return next;
                                  })
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
                              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                                <IndeterminateCheckbox
                                  checked={allInGroup}
                                  indeterminate={someInGroup}
                                  disabled={patchMut.isPending || territoriesQ.isLoading}
                                  onChange={(e) => {
                                    const n = new Set(modalSel);
                                    if (e.target.checked) {
                                      for (const k of groupLeafKeys) n.add(k);
                                    } else {
                                      for (const k of groupLeafKeys) n.delete(k);
                                    }
                                    setModalSel(n);
                                  }}
                                />
                                <span className="text-sm font-semibold tracking-tight">{territoryZoneLabel(g.group)}</span>
                              </label>
                            </div>
                            {expanded ? (
                              <div className="ml-3 space-y-1 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                                {g.subgroups.map((sub) => {
                                  const subKeys = sub.items.map((r) => String(r.id));
                                  const subAll = subKeys.length > 0 && subKeys.every((k) => modalSel.has(k));
                                  const subSome =
                                    subKeys.some((k) => modalSel.has(k)) && !subAll;
                                  const subKeyFull = `${g.group}::${sub.key}`;
                                  const subOpen =
                                    sub.key === "__direct__" ? true : territorySubExpanded.has(subKeyFull);

                                  const leafBlock = (
                                    <div
                                      className={cn(
                                        "space-y-0",
                                        sub.key !== "__direct__" &&
                                          "mt-0.5 border-l border-dashed border-border/50 pl-3"
                                      )}
                                    >
                                      {sub.items.map((r) => (
                                        <label
                                          key={r.id}
                                          className={cn(
                                            "flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1",
                                            sub.key !== "__direct__" && "pl-1",
                                            !r.is_active && "opacity-75"
                                          )}
                                        >
                                          <input
                                            type="checkbox"
                                            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                            disabled={patchMut.isPending || territoriesQ.isLoading}
                                            checked={modalSel.has(String(r.id))}
                                            title={
                                              r.code
                                                ? `${territoryLeafNameOnly(r)} · ${r.code}`
                                                : territoryLeafNameOnly(r)
                                            }
                                            onChange={(e) => {
                                              const n = new Set(modalSel);
                                              const k = String(r.id);
                                              if (e.target.checked) n.add(k);
                                              else n.delete(k);
                                              setModalSel(n);
                                            }}
                                          />
                                          <span className="min-w-0 text-sm leading-snug">
                                            <span className="font-medium text-foreground">{territoryLeafNameOnly(r)}</span>
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  );

                                  if (sub.key === "__direct__") {
                                    return <div key={`${g.group}::__direct__`}>{leafBlock}</div>;
                                  }

                                  return (
                                    <div key={sub.key} className="pb-1">
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                                          onClick={() =>
                                            setTerritorySubExpanded((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(subKeyFull)) next.delete(subKeyFull);
                                              else next.add(subKeyFull);
                                              return next;
                                            })
                                          }
                                          aria-expanded={subOpen}
                                          aria-label={subOpen ? "Свернуть регион" : "Развернуть регион"}
                                        >
                                          {subOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5">
                                          <IndeterminateCheckbox
                                            checked={subAll}
                                            indeterminate={subSome}
                                            disabled={patchMut.isPending || territoriesQ.isLoading}
                                            onChange={(e) => {
                                              const n = new Set(modalSel);
                                              if (e.target.checked) {
                                                for (const k of subKeys) n.add(k);
                                              } else {
                                                for (const k of subKeys) n.delete(k);
                                              }
                                              setModalSel(n);
                                            }}
                                          />
                                          <span className="text-sm font-semibold tracking-tight text-foreground">
                                            {sub.label || sub.key}
                                          </span>
                                        </label>
                                      </div>
                                      {subOpen ? leafBlock : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : modal === "staff" ? (
            <div className="flex min-h-0 flex-col gap-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1 text-xs"
                  disabled={
                    patchMut.isPending ||
                    staffPickBootstrapping ||
                    !(supervisorPickQ.data?.length ?? 0)
                  }
                  onClick={() => toggleExpandCollapseStaffRoles()}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {allStaffGroupsInViewExpanded ? "Свернуть все" : "Развернуть все"}
                </Button>
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    aria-label="Поиск по сотрудникам"
                  />
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                  <IndeterminateCheckbox
                    checked={
                      visibleStaffPickIds.length > 0 &&
                      visibleStaffPickIds.every((k) => modalSel.has(k))
                    }
                    indeterminate={
                      visibleStaffPickIds.some((k) => modalSel.has(k)) &&
                      !(
                        visibleStaffPickIds.length > 0 &&
                        visibleStaffPickIds.every((k) => modalSel.has(k))
                      )
                    }
                    disabled={
                      patchMut.isPending || staffPickBootstrapping || visibleStaffPickIds.length === 0
                    }
                    onChange={(e) => {
                      const n = new Set(modalSel);
                      if (e.target.checked) {
                        for (const k of visibleStaffPickIds) n.add(k);
                      } else {
                        for (const k of visibleStaffPickIds) n.delete(k);
                      }
                      setModalSel(n);
                    }}
                  />
                  Выбрать все
                </label>
              </div>
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {staffPickBootstrapping ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка пользователей…</span>
                  </div>
                ) : staffPickByRole.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {supervisorPickQ.data?.length ? "Никого не найдено по фильтру" : "Нет пользователей"}
                  </p>
                ) : (
                  <div className="space-y-0">
                    {staffPickByRole.map(({ role, items }) => {
                      const expanded = staffRoleExpanded.includes(role);
                      const leafKeys = items.map((u) => String(u.id));
                      const allIn = leafKeys.length > 0 && leafKeys.every((k) => modalSel.has(k));
                      const someIn = leafKeys.some((k) => modalSel.has(k)) && !allIn;
                      return (
                        <div key={role} className="border-b border-border/40 last:border-b-0">
                          <div className="flex items-center gap-0.5 py-1 pr-0.5">
                            <button
                              type="button"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                              onClick={() =>
                                setStaffRoleExpanded((prev) =>
                                  prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
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
                              {staffRoleGroupLabel(role)}
                            </span>
                            <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap py-0.5 text-xs text-muted-foreground">
                              <IndeterminateCheckbox
                                checked={allIn}
                                indeterminate={someIn}
                                disabled={patchMut.isPending || staffPickBootstrapping}
                                onChange={(e) => {
                                  const n = new Set(modalSel);
                                  if (e.target.checked) {
                                    for (const k of leafKeys) n.add(k);
                                  } else {
                                    for (const k of leafKeys) n.delete(k);
                                  }
                                  setModalSel(n);
                                }}
                              />
                              Выбрать все
                            </label>
                          </div>
                          {expanded ? (
                            <div className="ml-3 space-y-0 border-l border-border/45 pb-2 pl-2 sm:ml-4 sm:pl-3">
                              {items.map((u) => (
                                <label
                                  key={u.id}
                                  className={cn(
                                    "flex cursor-pointer items-start gap-2 py-1.5 pl-0.5 sm:pl-1",
                                    !u.is_active && "opacity-75"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                                    disabled={patchMut.isPending || staffPickBootstrapping}
                                    checked={modalSel.has(String(u.id))}
                                    onChange={(e) => {
                                      const n = new Set(modalSel);
                                      const k = String(u.id);
                                      if (e.target.checked) n.add(k);
                                      else n.delete(k);
                                      setModalSel(n);
                                    }}
                                  />
                                  <span className="min-w-0 text-sm leading-snug">
                                    <span className="font-medium text-foreground">{formatStaffPickLine(u)}</span>
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
          ) : modal === "operations" ? (
            <div className="flex flex-col gap-2 overflow-hidden">
              <p className="text-[11px] text-muted-foreground">
                Доступно для добавления: {attachModalBaseItems.length}. Выберите операции сверх базовых прав роли — они
                будут назначены только этому пользователю.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={opAttachGroupKeys.length === 0}
                  onClick={() => {
                    if (opAttachGroupKeys.length === 0) return;
                    if (allOpAttachGroupsExpanded) setOpAttachGroupExpanded(new Set());
                    else setOpAttachGroupExpanded(new Set(opAttachGroupKeys));
                  }}
                >
                  {allOpAttachGroupsExpanded ? "Свернуть все" : "Развернуть все"}
                </Button>
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                  />
                </div>
                <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={showSelOnly} onChange={(e) => setShowSelOnly(e.target.checked)} />
                  Показать только выбранные
                </label>
              </div>
              <div className="max-h-[48vh] overflow-auto rounded border border-border/60 p-2">
                {catalogQ.isLoading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Загрузка каталога…</p>
                ) : opAttachGroups.length === 0 ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    {attachModalBaseItems.length === 0
                      ? "Все операции из каталога уже доступны пользователю или добавление ограничено."
                      : "Ничего не найдено по фильтру"}
                  </p>
                ) : (
                  opAttachGroups.map((grp) => {
                  const expanded = opAttachGroupExpanded.has(grp.parent);
                  const groupKeys = grp.items.map((item) => item.key);
                  const groupAllSelected =
                    groupKeys.length > 0 && groupKeys.every((k) => modalSel.has(k));
                  const groupSomeSelected =
                    groupKeys.length > 0 && groupKeys.some((k) => modalSel.has(k)) && !groupAllSelected;
                  return (
                    <div key={grp.parent} className="border-b border-border/40 py-1 last:border-b-0">
                      <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold"
                          onClick={() =>
                            setOpAttachGroupExpanded((prev) => {
                              const n = new Set(prev);
                              if (n.has(grp.parent)) n.delete(grp.parent);
                              else n.add(grp.parent);
                              return n;
                            })
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <span className="min-w-0 truncate" title={grp.parent}>
                            {shortenPathLabel(grp.parent)}
                          </span>
                          <span className="shrink-0 font-normal text-muted-foreground">({grp.items.length})</span>
                        </button>
                        <IndeterminateCheckbox
                          checked={groupAllSelected}
                          indeterminate={groupSomeSelected}
                          disabled={patchMut.isPending || groupKeys.length === 0}
                          className="h-4 w-4 shrink-0 accent-teal-700"
                          title={`Выбрать все операции категории «${shortenPathLabel(grp.parent)}»`}
                          aria-label={`Выбрать все операции категории: ${shortenPathLabel(grp.parent)}`}
                          onChange={(e) => toggleOpAttachGroup(grp.items, e.target.checked)}
                        />
                      </div>
                      {expanded ? (
                        <div className="mt-0.5 space-y-0 border-l border-border/45 pl-2">
                          {grp.items.map((item) => (
                              <label
                                key={item.key}
                                className="flex cursor-pointer items-start gap-2 border-b border-border/30 py-1.5 last:border-b-0"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 accent-teal-700"
                                  disabled={patchMut.isPending}
                                  checked={modalSel.has(item.key)}
                                  title="Дополнительная операция только для этого пользователя"
                                  onChange={(e) => {
                                    const n = new Set(modalSel);
                                    if (e.target.checked) n.add(item.key);
                                    else n.delete(item.key);
                                    setModalSel(n);
                                  }}
                                />
                                <span className="text-xs">
                                  <span className="font-medium">{item.label}</span>
                                  {item.sub ? (
                                    <span className="ml-2 block text-muted-foreground">
                                      <span className="font-medium text-foreground/80">Родитель:</span> {item.sub}
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          ) : dimPickModal ? (
            <div className="flex min-h-0 flex-col gap-2 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[10rem] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по названию"
                    className="h-8 w-full pl-8 text-xs"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    aria-label="Поиск по списку объектов"
                  />
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
                  <IndeterminateCheckbox
                    checked={dimPickAllSelected}
                    indeterminate={dimPickSomeSelected}
                    disabled={patchMut.isPending || dimQ.isLoading || visibleDimPickKeys.length === 0}
                    onChange={(e) => {
                      const n = new Set(modalSel);
                      if (e.target.checked) {
                        for (const k of visibleDimPickKeys) n.add(k);
                      } else {
                        for (const k of visibleDimPickKeys) n.delete(k);
                      }
                      setModalSel(n);
                    }}
                  />
                  Выбрать все
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={showSelOnly}
                  onChange={(e) => setShowSelOnly(e.target.checked)}
                />
                Показать только выбранные
              </label>
              <div className="max-h-[min(52vh,440px)] min-h-[220px] overflow-auto rounded-lg border border-border/60 bg-muted/15 p-2">
                {dimQ.isLoading ? (
                  <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-hidden />
                    <span>Загрузка списка…</span>
                  </div>
                ) : filteredModalItems.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
                ) : (
                  <div className="space-y-0">
                    {filteredModalItems.map((item) => {
                      const count = item.sub.trim();
                      return (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-2 border-b border-border/40 py-2 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700"
                            disabled={patchMut.isPending}
                            checked={modalSel.has(item.key)}
                            onChange={(e) => {
                              const n = new Set(modalSel);
                              if (e.target.checked) n.add(item.key);
                              else n.delete(item.key);
                              setModalSel(n);
                            }}
                          />
                          <span className="min-w-0 text-sm leading-snug">
                            <span className="font-medium text-foreground">{item.label}</span>
                            {count ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                Пользователей с доступом к объекту:{" "}
                                <span className="tabular-nums text-foreground/80">{count}</span>
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter
            className={cn(
              "gap-2 border-t border-border/80 pt-3",
              modal === "staff"
                ? "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between"
                : "sm:justify-end"
            )}
          >
            {modal === "staff" ? (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground sm:mr-auto">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={showSelOnly}
                  onChange={(e) => setShowSelOnly(e.target.checked)}
                />
                Показать только выбранные
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setModal(null)}>
                Отменить
              </Button>
              <Button
                className="bg-teal-700 text-white hover:bg-teal-800"
                type="button"
                disabled={
                  patchMut.isPending ||
                  (modal === "operations" && catalogQ.isLoading) ||
                  (modal === "territory" && territoriesQ.isLoading) ||
                  (modal === "staff" && staffPickBootstrapping) ||
                  (dimPickModal && dimQ.isLoading)
                }
                onClick={() => void saveModal()}
              >
                {patchMut.isPending ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
