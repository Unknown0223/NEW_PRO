"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { cn } from "@/lib/utils";
import {
  buildOperationsDraftPatch,
  draftChangedKeys,
  filterAccessTree,
  isFlatAccessModule,
  moduleKeys,
  sectionKeys,
  treeKeys,
  type AccessOpMatrixState,
  type AccessTreeModule,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";
import { formatOpsCount } from "@/lib/access-history-summary";
import { GroupCheckbox } from "@/components/access/permission-tree/permission-tree";
import { userMessageAfterAccessPatchFailure } from "./access-user-detail.types";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

const GRANT_CHUNK = 80;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vm: AccessUserDetailVm;
  tree: readonly AccessTreeModule[];
  stateByKey: ReadonlyMap<string, AccessOpMatrixState>;
  isDisabled: (key: string) => boolean;
  onSaved: (text: string) => void;
  onError: (text: string, detail: string) => void;
};

/** «Прикрепить операции: <пользователь>» — modul → bo'lim → operatsiya daraxti, «Выбрать все», saqlash/bekor qilish. */
export function AccessAttachOperationsDialog({ open, onOpenChange, vm, tree, stateByKey, isDisabled, onSaved, onError }: Props) {
  const [draft, setDraft] = useState<Map<string, boolean>>(() => new Map());
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [grantOthers, setGrantOthers] = useState(false);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useAppConfirm();

  useEffect(() => {
    if (!open) return;
    setDraft(new Map());
    setSearch("");
    setExpanded(new Set());
    setGrantOthers(false);
  }, [open]);

  const isOn = (key: string) => (draft.has(key) ? draft.get(key)! : Boolean(stateByKey.get(key)?.effective));
  const onToggle = (keys: string[], next: boolean) =>
    setDraft((prev) => {
      const d = new Map(prev);
      for (const k of keys) {
        if (Boolean(stateByKey.get(k)?.effective) === next) d.delete(k);
        else d.set(k, next);
      }
      return d;
    });

  const visibleTree = useMemo(() => filterAccessTree(tree, search), [tree, search]);
  const visibleKeys = useMemo(() => treeKeys(visibleTree), [visibleTree]);
  const allKeys = useMemo(() => treeKeys(tree), [tree]);
  const changes = useMemo(() => draftChangedKeys(stateByKey, draft), [stateByKey, draft]);
  const dirty = changes.added.length + changes.removed.length > 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedCount = useMemo(() => allKeys.filter(isOn).length, [allKeys, draft, stateByKey]);
  const searching = search.trim().length > 0;

  const groupIds = useMemo(
    () => visibleTree.flatMap((m) => [m.id, ...(isFlatAccessModule(m) ? [] : m.sections.map((s) => s.id))]),
    [visibleTree]
  );
  const allExpanded = groupIds.length > 0 && groupIds.every((id) => expanded.has(id));
  const isOpen = (id: string) => searching || expanded.has(id);
  const toggleOpen = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const requestClose = async () => {
    if (saving) return;
    if (dirty) {
      const ok = await confirm({
        title: "Несохраненные изменения",
        message: "Закрыть окно без сохранения? Выбранные изменения будут потеряны.",
        confirmLabel: "Закрыть",
        cancelLabel: "Остаться",
        destructive: true
      });
      if (!ok) return;
    }
    onOpenChange(false);
  };

  const save = async () => {
    const body = buildOperationsDraftPatch(stateByKey, draft);
    if (!body) return;
    if (changes.removed.length > 0) {
      const ok = await confirm({
        title: "Открепить операции",
        message: "Вы действительно хотите открепить выбранные операции?",
        detail: `Будет откреплено: ${formatOpsCount(changes.removed.length)}.`,
        confirmLabel: "Открепить и сохранить",
        cancelLabel: "Отмена",
        destructive: true
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await vm.patchMut.mutateAsync(body);
      if (grantOthers && changes.added.length > 0) {
        for (let i = 0; i < changes.added.length; i += GRANT_CHUNK) {
          await vm.patchMut.mutateAsync({ grant_delegation_allow: changes.added.slice(i, i + GRANT_CHUNK) });
        }
      }
      await vm.detailQ.refetch();
      const parts = [
        changes.added.length ? `прикреплено ${formatOpsCount(changes.added.length)}` : "",
        changes.removed.length ? `откреплено ${formatOpsCount(changes.removed.length)}` : ""
      ].filter(Boolean);
      onSaved(`Изменения сохранены: ${parts.join(", ")}`);
      onOpenChange(false);
    } catch (err) {
      await vm.detailQ.refetch();
      onError("Не удалось сохранить изменения", userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз."));
    } finally {
      setSaving(false);
    }
  };

  const userName = vm.user ? vm.user.full_name || vm.user.login : "";

  const opRow = (op: AccessTreeOperation, label: string, depth: 1 | 2) => {
    const disabled = isDisabled(op.key);
    const changed = draft.has(op.key);
    return (
      <li key={op.key} role="treeitem" aria-selected={isOn(op.key)} className={cn("relative", depth === 2 && "pl-5")}>
        {depth === 2 ? <span className="absolute left-[0.6rem] top-1/2 h-px w-3 bg-border" aria-hidden /> : null}
        <label
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted/60",
            disabled && "cursor-not-allowed text-muted-foreground"
          )}
          title={disabled ? "Нет права выдавать эту операцию" : op.key}
        >
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-teal-700"
            checked={isOn(op.key)}
            disabled={disabled}
            onChange={(e) => onToggle([op.key], e.target.checked)}
          />
          <span className="min-w-0 flex-1 leading-snug">{label}</span>
          {changed ? (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 text-[10px] font-medium",
                draft.get(op.key)
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
              )}
            >
              {draft.get(op.key) ? "добавится" : "открепится"}
            </span>
          ) : null}
        </label>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : void requestClose())}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(48rem,calc(100vw-2rem))]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <DialogTitle className="min-w-0 truncate text-[15px] font-normal text-muted-foreground">
            Прикрепить операции: <span className="font-semibold text-foreground">{userName}</span>
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void requestClose()}
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Отметьте операции, которые должны быть у пользователя, и нажмите «Сохранить».
        </DialogDescription>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={searching}
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(groupIds))}
          >
            {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden />}
            {allExpanded ? "Свернуть все" : "Развернуть все"}
          </Button>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Поиск"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск операции"
              autoFocus
            />
          </div>
          <label className="ml-auto flex items-center gap-2 text-xs font-medium">
            <GroupCheckbox keys={visibleKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label="все операции" />
            Выбрать все
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {visibleTree.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">Ничего не найдено</p>
          ) : (
            <ul role="tree" aria-label="Операции">
              {visibleTree.map((mod) => {
                const mKeys = moduleKeys(mod);
                const mOn = mKeys.filter(isOn).length;
                const modOpen = isOpen(mod.id);
                return (
                  <li key={mod.id} role="treeitem" aria-expanded={modOpen} aria-selected={false} className="border-b border-border/60 last:border-b-0">
                    <div className="sticky top-0 z-[1] flex items-center gap-2 bg-muted/70 px-4 py-2 backdrop-blur">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px] font-semibold"
                        onClick={() => toggleOpen(mod.id)}
                        aria-label={`${modOpen ? "Свернуть" : "Развернуть"}: ${mod.label}`}
                      >
                        {modOpen ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                        <span className="truncate">{mod.label}</span>
                        {mOn > 0 ? (
                          <span className="shrink-0 rounded-full bg-teal-700/10 px-1.5 text-[10.5px] font-medium tabular-nums text-teal-800 dark:text-teal-200">
                            {mOn} / {mKeys.length}
                          </span>
                        ) : null}
                      </button>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <GroupCheckbox keys={mKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label={mod.label} />
                        Выбрать все
                      </label>
                    </div>
                    {modOpen ? (
                      <ul role="group" className="space-y-0.5 px-4 py-2">
                        {mod.sections.map((sec) => {
                          if (isFlatAccessModule(mod)) return opRow(sec.operations[0], sec.operations[0].label, 1);
                          const sKeys = sectionKeys(sec);
                          const secOpen = isOpen(sec.id);
                          return (
                            <li key={sec.id} role="treeitem" aria-expanded={secOpen} aria-selected={false}>
                              <div className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-muted/60">
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                  onClick={() => toggleOpen(sec.id)}
                                  aria-label={`${secOpen ? "Свернуть" : "Развернуть"}: ${sec.label}`}
                                >
                                  {secOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                                </button>
                                <GroupCheckbox keys={sKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label={sec.label} />
                                <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-medium" onClick={() => toggleOpen(sec.id)}>
                                  {sec.label}
                                </button>
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                  {sKeys.filter(isOn).length} / {sKeys.length}
                                </span>
                              </div>
                              {secOpen ? (
                                <ul role="group" className="relative ml-[1.1rem] border-l border-border pl-1">
                                  {sec.operations.map((op) => opRow(op, op.label, 2))}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-4 py-3">
          <label
            className="flex items-center gap-2 text-xs"
            title="Пользователь сможет сам выдавать прикрепляемые сейчас операции другим пользователям"
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={grantOthers}
              disabled={changes.added.length === 0}
              onChange={(e) => setGrantOthers(e.target.checked)}
            />
            Возможность предоставления другими пользователям
          </label>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Выбрано: <b className="tabular-nums text-foreground">{formatOpsCount(selectedCount)}</b>
            {dirty ? (
              <span className="ml-2 text-amber-700 dark:text-amber-300">
                {changes.added.length ? `+${changes.added.length}` : ""}
                {changes.added.length && changes.removed.length ? " / " : ""}
                {changes.removed.length ? `−${changes.removed.length}` : ""}
              </span>
            ) : null}
          </span>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void requestClose()}>
              Отменить
            </Button>
            <Button type="button" size="sm" className="bg-teal-700 text-white hover:bg-teal-800" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        </div>
        {dialog}
      </DialogContent>
    </Dialog>
  );
}
