"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { cn } from "@/lib/utils";
import {
  buildOperationsDraftPatch,
  draftChangedKeys,
  filterAccessTree,
  opStateLabel,
  treeKeys,
  type AccessOpMatrixState,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";
import { PermissionTree, GroupCheckbox } from "@/components/access/permission-tree/permission-tree";
import { PermissionTable } from "@/components/access/permission-tree/permission-table";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { AccessUnsavedBar, useAccessToast, useBeforeUnloadWarning } from "@/components/access/permission-tree/access-save-bar";
import { userMessageAfterAccessPatchFailure } from "./access-user-detail.types";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

type ShowFilter = "all" | "on" | "off";

const STATE_BADGE: Record<ReturnType<typeof opStateLabel>, string> = {
  "Из роли": "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  Лично: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
  Запрещено: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  "Не назначено": "border-transparent text-muted-foreground"
};

export function AccessUserOperationsEditor({
  vm,
  onDirtyChange
}: {
  vm: AccessUserDetailVm;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const treeQ = useAccessOperationsTree(vm.tenantSlug);
  const detail = vm.detailQ.data;
  const [draft, setDraft] = useState<Map<string, boolean>>(() => new Map());
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<ShowFilter>("all");
  const [view, setView] = useState<"tree" | "table">("tree");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useAppConfirm();
  const toast = useAccessToast();

  const stateByKey = useMemo(() => {
    const m = new Map<string, AccessOpMatrixState>();
    for (const r of detail?.matrix ?? []) m.set(r.key, r);
    return m;
  }, [detail?.matrix]);

  const actor = detail?.actor;
  const grantable = useMemo(
    () => (actor && !actor.is_admin && actor.grantable_keys ? new Set(actor.grantable_keys) : null),
    [actor]
  );
  const readOnly = actor ? !actor.can_edit_user : false;
  const isDisabled = (key: string) => readOnly || (grantable != null && !grantable.has(key));

  const isOn = (key: string) => (draft.has(key) ? draft.get(key)! : Boolean(stateByKey.get(key)?.effective));

  const onToggle = (keys: string[], next: boolean) => {
    setDraft((prev) => {
      const d = new Map(prev);
      for (const k of keys) {
        if (Boolean(stateByKey.get(k)?.effective) === next) d.delete(k);
        else d.set(k, next);
      }
      return d;
    });
  };

  const changes = useMemo(() => draftChangedKeys(stateByKey, draft), [stateByKey, draft]);
  const dirty = changes.added.length + changes.removed.length > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useBeforeUnloadWarning(dirty);

  const fullTree = treeQ.data ?? [];
  const allKeys = useMemo(() => treeKeys(fullTree), [fullTree]);
  const selectedCount = allKeys.filter(isOn).length;
  const visibleTree = useMemo(
    () =>
      filterAccessTree(fullTree, search, show === "all" ? undefined : (op: AccessTreeOperation) => isOn(op.key) === (show === "on")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullTree, search, show, draft, stateByKey]
  );
  const visibleKeys = useMemo(() => treeKeys(visibleTree), [visibleTree]);

  const expandAll = () => setExpanded(new Set(visibleTree.flatMap((m) => [m.id, ...m.sections.map((s) => s.id)])));
  const allExpanded = visibleTree.length > 0 && visibleTree.every((m) => expanded.has(m.id));

  const save = async () => {
    const body = buildOperationsDraftPatch(stateByKey, draft);
    if (!body) return;
    if (changes.removed.length > 0) {
      const ok = await confirm({
        title: "Открепить операции",
        message: "Вы действительно хотите открепить выбранные операции?",
        detail: `Будет откреплено операций: ${changes.removed.length}.`,
        confirmLabel: "Открепить",
        cancelLabel: "Отмена"
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      await vm.patchMut.mutateAsync(body);
      await vm.detailQ.refetch();
      setDraft(new Map());
      toast.show({ tone: "ok", text: "Изменения сохранены" });
    } catch (err) {
      toast.show({
        tone: "err",
        text: "Не удалось сохранить изменения",
        detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.")
      });
    } finally {
      setSaving(false);
    }
  };

  const renderOpExtra = (op: AccessTreeOperation) => {
    const changed = draft.has(op.key);
    const label = opStateLabel(stateByKey.get(op.key));
    return (
      <span className="flex shrink-0 items-center gap-1">
        {changed ? (
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
            {draft.get(op.key) ? "Будет добавлено" : "Будет откреплено"}
          </span>
        ) : null}
        <span className={cn("rounded border px-1.5 text-[10px] font-medium", STATE_BADGE[label])}>{label}</span>
      </span>
    );
  };

  if (treeQ.isError) {
    return <PageError message="Не удалось загрузить список операций." onRetry={() => void treeQ.refetch()} />;
  }
  if (treeQ.isLoading || !detail) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Загрузка операций">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  const extraRoleKeys = vm.extraRoleKeys;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 rounded-lg border border-border/60 bg-card p-2.5">
        {readOnly ? (
          <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            Права администратора может изменять только администратор.
          </p>
        ) : grantable ? (
          <p className="text-xs text-muted-foreground">
            Вы можете выдавать или откреплять только операции, на которые у вас есть право «может выдавать». Остальные недоступны для изменения.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Поиск операции"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Поиск операции"
            />
          </div>
          <select
            className="access-filter-select h-8 text-xs"
            value={show}
            onChange={(e) => setShow(e.target.value as ShowFilter)}
            aria-label="Показать операции"
          >
            <option value="all">Все операции</option>
            <option value="on">Только выбранные</option>
            <option value="off">Только не выбранные</option>
          </select>
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Вид">
            {(["tree", "table"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn("rounded px-2.5 py-1 text-xs", view === v ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted")}
              >
                {v === "tree" ? "Дерево" : "Таблица"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium">
              <GroupCheckbox keys={visibleKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label="видимые операции" />
              Выбрать все
            </label>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Выбрано: <b className="tabular-nums text-foreground">{selectedCount}</b> из {allKeys.length} операций
            </span>
            {view === "tree" && !search ? (
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => (allExpanded ? setExpanded(new Set()) : expandAll())}>
                {allExpanded ? "Свернуть все" : "Развернуть все"}
              </Button>
            ) : null}
          </div>
          {!readOnly ? (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={() => vm.openModal("role_packs")}>
              <Layers className="h-3.5 w-3.5" aria-hidden />
              Операции по группам
            </Button>
          ) : null}
        </div>
        {extraRoleKeys.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Добавленные группы:</span>
            {extraRoleKeys.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-0.5 rounded-full border border-teal-700/30 bg-teal-50 px-2 py-0.5 text-[11px] text-teal-900 dark:bg-teal-950/40 dark:text-teal-100"
              >
                {vm.extraRoleLabelByKey.get(key) ?? key}
                {!readOnly ? (
                  <button
                    type="button"
                    className="ml-0.5 rounded-full p-0.5 hover:bg-teal-200/80 dark:hover:bg-teal-900"
                    aria-label={`Убрать группу ${vm.extraRoleLabelByKey.get(key) ?? key}`}
                    disabled={vm.patchMut.isPending || dirty}
                    title={dirty ? "Сначала сохраните или отмените изменения" : undefined}
                    onClick={() => void vm.removeExtraRolePack(key)}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5">
        {visibleTree.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {search ? "Ничего не найдено" : show === "on" ? "Никаких разрешений не предоставлено" : "Нет операций"}
          </div>
        ) : view === "tree" ? (
          <PermissionTree
            tree={visibleTree}
            isOn={isOn}
            onToggle={onToggle}
            isDisabled={isDisabled}
            renderOpExtra={renderOpExtra}
            expanded={expanded}
            onExpandedChange={setExpanded}
            forceExpanded={search.trim().length > 0}
          />
        ) : (
          <PermissionTable tree={visibleTree} isOn={isOn} onToggle={onToggle} isDisabled={isDisabled} renderOpExtra={renderOpExtra} />
        )}
      </div>

      {dirty ? (
        <AccessUnsavedBar
          added={changes.added.length}
          removed={changes.removed.length}
          pending={saving}
          onCancel={() => setDraft(new Map())}
          onSave={() => void save()}
        />
      ) : null}
      {dialog}
      {toast.node}
    </div>
  );
}
