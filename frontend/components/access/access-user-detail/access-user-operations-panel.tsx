"use client";

import { useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw, Search, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { cn } from "@/lib/utils";
import {
  filterAccessTree,
  opMatchesFilter,
  opStateLabel,
  patchForKeys,
  treeKeys,
  type AccessOpMatrixState,
  type AccessOpsFilter,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";
import { formatOpsCount } from "@/lib/access-history-summary";
import { PermissionTree } from "@/components/access/permission-tree/permission-tree";
import { PermissionTable } from "@/components/access/permission-tree/permission-table";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { AccessAttachOperationsDialog } from "./access-attach-operations-dialog";
import { userMessageAfterAccessPatchFailure } from "./access-user-detail.types";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

const GRANT_CHUNK = 80;

const STATE_BADGE: Record<ReturnType<typeof opStateLabel>, string> = {
  "Из роли": "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  Лично: "border-teal-300 bg-teal-50 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
  Запрещено: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  "Не назначено": "border-transparent text-muted-foreground"
};

/** «Операции»: foydalanuvchida bor operatsiyalar (daraxt / jadval), ommaviy amallar va «Прикрепить операции». */
export function AccessUserOperationsPanel({ vm, filter }: { vm: AccessUserDetailVm; filter: AccessOpsFilter }) {
  const treeQ = useAccessOperationsTree(vm.tenantSlug);
  const detail = vm.detailQ.data;
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"tree" | "table">("tree");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [attachOpen, setAttachOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useAppConfirm();
  const toast = useAccessToast();

  const stateByKey = useMemo(() => {
    const m = new Map<string, AccessOpMatrixState>();
    for (const r of detail?.matrix ?? []) m.set(r.key, r);
    return m;
  }, [detail?.matrix]);
  const grantSet = useMemo(() => new Set(detail?.grant_delegation_operation_keys ?? []), [detail?.grant_delegation_operation_keys]);

  const actor = detail?.actor;
  const grantable = useMemo(
    () => (actor && !actor.is_admin && actor.grantable_keys ? new Set(actor.grantable_keys) : null),
    [actor]
  );
  const readOnly = actor ? !actor.can_edit_user : false;
  const isDisabled = (key: string) => readOnly || (grantable != null && !grantable.has(key));

  const fullTree = useMemo(() => treeQ.data ?? [], [treeQ.data]);
  const scopedTree = useMemo(() => (filter.module ? fullTree.filter((m) => m.id === filter.module) : fullTree), [fullTree, filter.module]);
  const visibleTree = useMemo(
    () => filterAccessTree(scopedTree, search, (op) => opMatchesFilter(stateByKey.get(op.key), grantSet.has(op.key), filter)),
    [scopedTree, search, stateByKey, grantSet, filter]
  );
  const visibleKeys = useMemo(() => treeKeys(visibleTree), [visibleTree]);
  const effectiveCount = useMemo(() => treeKeys(fullTree).filter((k) => stateByKey.get(k)?.effective).length, [fullTree, stateByKey]);
  const selKeys = visibleKeys.filter((k) => sel.has(k));
  const deniedView = filter.source === "denied";

  const run = async (bodies: Record<string, unknown>[], okText: string) => {
    if (bodies.length === 0) return;
    setBusy(true);
    try {
      for (const b of bodies) await vm.patchMut.mutateAsync(b);
      await vm.detailQ.refetch();
      setSel(new Set());
      toast.show({ tone: "ok", text: okText });
    } catch (err) {
      await vm.detailQ.refetch();
      toast.show({ tone: "err", text: "Не удалось сохранить изменения", detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.") });
    } finally {
      setBusy(false);
    }
  };

  const detach = async (keys: string[]) => {
    const editable = keys.filter((k) => !isDisabled(k));
    const body = patchForKeys(stateByKey, editable, false);
    if (!body) return;
    const ok = await confirm({
      title: "Открепить операции",
      message: "Вы действительно хотите открепить выбранные операции?",
      detail:
        editable.length === 1
          ? `«${labelOf(editable[0])}»`
          : `Будет откреплено: ${formatOpsCount(editable.length)}. Операции из роли будут запрещены лично для пользователя.`,
      confirmLabel: "Открепить",
      cancelLabel: "Отмена",
      destructive: true
    });
    if (ok) await run([body], `Откреплено: ${formatOpsCount(editable.length)}`);
  };

  const restore = async (keys: string[]) => {
    const editable = keys.filter((k) => !isDisabled(k));
    const body = patchForKeys(stateByKey, editable, true);
    if (body) await run([body], `Запрет снят: ${formatOpsCount(editable.length)}`);
  };

  const setDelegation = async (keys: string[], allow: boolean) => {
    const editable = keys.filter((k) => !isDisabled(k) && grantSet.has(k) !== allow);
    if (editable.length === 0) return;
    const ok = await confirm({
      title: allow ? "Разрешить выдавать другим" : "Запретить выдавать другим",
      message: allow
        ? "Пользователь сможет выдавать выбранные операции другим пользователям."
        : "Пользователь больше не сможет выдавать выбранные операции другим пользователям.",
      detail: formatOpsCount(editable.length),
      confirmLabel: allow ? "Разрешить" : "Запретить",
      cancelLabel: "Отмена",
      destructive: !allow
    });
    if (!ok) return;
    const field = allow ? "grant_delegation_allow" : "grant_delegation_revoke";
    const bodies: Record<string, unknown>[] = [];
    for (let i = 0; i < editable.length; i += GRANT_CHUNK) bodies.push({ [field]: editable.slice(i, i + GRANT_CHUNK) });
    await run(bodies, allow ? "Выдача другим разрешена" : "Выдача другим запрещена");
  };

  const labelByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const mod of fullTree) for (const s of mod.sections) for (const o of s.operations) m.set(o.key, o.label);
    return m;
  }, [fullTree]);
  const labelOf = (key: string) => labelByKey.get(key) ?? key;

  const renderOpExtra = (op: AccessTreeOperation) => {
    const label = opStateLabel(stateByKey.get(op.key));
    const disabled = isDisabled(op.key) || busy;
    return (
      <span className="flex shrink-0 items-center gap-1">
        {grantSet.has(op.key) && !deniedView ? (
          <span
            className="inline-flex items-center gap-0.5 rounded border border-violet-300 bg-violet-50 px-1.5 text-[10px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200"
            title="Может выдавать эту операцию другим"
          >
            <KeyRound className="h-2.5 w-2.5" aria-hidden />
            выдаёт
          </span>
        ) : null}
        <span className={cn("rounded border px-1.5 text-[10px] font-medium", STATE_BADGE[label])}>{label}</span>
        {!readOnly ? (
          deniedView ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void restore([op.key])}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
              aria-label={`Снять запрет: ${op.label}`}
              title="Снять запрет (вернуть из роли)"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => void detach([op.key])}
              className="rounded p-1 text-muted-foreground hover:bg-rose-100 hover:text-rose-700 disabled:opacity-40 dark:hover:bg-rose-950"
              aria-label={`Открепить: ${op.label}`}
              title="Открепить"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )
        ) : null}
      </span>
    );
  };

  if (treeQ.isError) return <PageError message="Не удалось загрузить список операций." onRetry={() => void treeQ.refetch()} />;
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

  const filtered = Boolean(search.trim()) || filter.module !== "" || filter.source !== "all" || filter.grant !== "all";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="h-8 pl-8 text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск операции" />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          onClick={() => void vm.detailQ.refetch()}
          disabled={vm.detailQ.isFetching}
          aria-label="Обновить"
          title="Обновить"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", vm.detailQ.isFetching && "animate-spin")} aria-hidden />
        </Button>
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
        {!readOnly ? (
          <Button type="button" size="sm" className="h-8 gap-1 bg-teal-700 text-xs text-white hover:bg-teal-800" onClick={() => setAttachOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Прикрепить операции
          </Button>
        ) : null}
      </div>

      {readOnly ? (
        <p className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          Права администратора может изменять только администратор.
        </p>
      ) : grantable ? (
        <p className="shrink-0 text-xs text-muted-foreground">
          Вы можете выдавать или откреплять только операции, которые вам разрешено выдавать другим.
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span aria-live="polite">
          {deniedView ? "Запрещено лично" : "Операций у пользователя"}: <b className="tabular-nums text-foreground">{deniedView ? visibleKeys.length : effectiveCount}</b>
          {filtered && !deniedView ? <> · показано {visibleKeys.length}</> : null}
        </span>
        {view === "tree" && !search.trim() && visibleTree.length > 0 ? (
          <button
            type="button"
            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
            onClick={() => {
              const all = visibleTree.every((m) => expanded.has(m.id));
              setExpanded(all ? new Set() : new Set(visibleTree.flatMap((m) => [m.id, ...m.sections.map((s) => s.id)])));
            }}
          >
            {visibleTree.every((m) => expanded.has(m.id)) ? "Свернуть все" : "Развернуть все"}
          </button>
        ) : null}
      </div>

      {selKeys.length > 0 && !readOnly ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs dark:border-teal-800 dark:bg-teal-950/50">
          <span>
            Выбрано: <b className="tabular-nums">{selKeys.length}</b>
          </span>
          {deniedView ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => void restore(selKeys)}>
              Снять запрет
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" variant="outline" className="h-7 border-rose-300 text-xs text-rose-700 hover:bg-rose-50" disabled={busy} onClick={() => void detach(selKeys)}>
                Открепить
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => void setDelegation(selKeys, true)}>
                Разрешить выдавать
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => void setDelegation(selKeys, false)}>
                Запретить выдавать
              </Button>
            </>
          )}
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setSel(new Set())}>
            Снять выделение
          </Button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5">
        {visibleTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <KeyRound className="h-7 w-7 text-muted-foreground" aria-hidden />
            </span>
            <p className="text-sm font-medium text-muted-foreground">
              {filtered ? "По заданным условиям ничего не найдено" : "Никаких разрешений не предоставлено"}
            </p>
            {!filtered && !readOnly ? (
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setAttachOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Прикрепить операции
              </Button>
            ) : null}
          </div>
        ) : view === "tree" ? (
          <PermissionTree
            tree={visibleTree}
            isOn={(k) => sel.has(k)}
            onToggle={(keys, next) =>
              setSel((prev) => {
                const s = new Set(prev);
                for (const k of keys) {
                  if (next) s.add(k);
                  else s.delete(k);
                }
                return s;
              })
            }
            isDisabled={(k) => readOnly || isDisabled(k)}
            renderOpExtra={renderOpExtra}
            expanded={expanded}
            onExpandedChange={setExpanded}
            forceExpanded={search.trim().length > 0}
            countMode="total"
          />
        ) : (
          <PermissionTable
            tree={visibleTree}
            isOn={(k) => sel.has(k)}
            onToggle={(keys, next) =>
              setSel((prev) => {
                const s = new Set(prev);
                for (const k of keys) {
                  if (next) s.add(k);
                  else s.delete(k);
                }
                return s;
              })
            }
            isDisabled={(k) => readOnly || isDisabled(k)}
            renderOpExtra={renderOpExtra}
          />
        )}
      </div>

      <AccessAttachOperationsDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        vm={vm}
        tree={fullTree}
        stateByKey={stateByKey}
        isDisabled={isDisabled}
        onSaved={(text) => toast.show({ tone: "ok", text })}
        onError={(text, detail) => toast.show({ tone: "err", text, detail })}
      />
      {dialog}
      {toast.node}
    </div>
  );
}
