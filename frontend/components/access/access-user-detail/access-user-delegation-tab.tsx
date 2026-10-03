"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageError } from "@/components/ui/page-error";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { filterAccessTree, treeKeys } from "@/lib/access-operations-tree";
import { ACCESS_MANAGE_KEY, normalizeAccessGrantPermissions } from "@/components/access/access-workspace.shared";
import { PermissionTree, GroupCheckbox } from "@/components/access/permission-tree/permission-tree";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { AccessUnsavedBar, useAccessToast, useBeforeUnloadWarning } from "@/components/access/permission-tree/access-save-bar";
import { userMessageAfterAccessPatchFailure } from "./access-user-detail.types";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";

const CHUNK = 80;

/** «Делегирование»: umumiy «Предоставление доступа» + har bir operatsiya uchun «может выдавать». */
export function AccessUserDelegationTab({
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useAppConfirm();
  const toast = useAccessToast();

  const matrixByKey = useMemo(() => new Map((detail?.matrix ?? []).map((r) => [r.key, r] as const)), [detail?.matrix]);
  const grantSet = useMemo(() => new Set(detail?.grant_delegation_operation_keys ?? []), [detail?.grant_delegation_operation_keys]);
  const actor = detail?.actor;
  const grantable = useMemo(
    () => (actor && !actor.is_admin && actor.grantable_keys ? new Set(actor.grantable_keys) : null),
    [actor]
  );
  const readOnly = actor ? !actor.can_edit_user : false;
  const isDisabled = (key: string) => readOnly || (grantable != null && !grantable.has(key));

  const manageRow = matrixByKey.get(ACCESS_MANAGE_KEY);
  const hasManage = Boolean(manageRow?.effective);
  const manageLocked = readOnly || (grantable != null && !grantable.has(ACCESS_MANAGE_KEY));

  const isOn = (key: string) => (draft.has(key) ? draft.get(key)! : grantSet.has(key));
  const onToggle = (keys: string[], next: boolean) =>
    setDraft((prev) => {
      const d = new Map(prev);
      for (const k of keys) {
        if (grantSet.has(k) === next) d.delete(k);
        else d.set(k, next);
      }
      return d;
    });

  const dirty = draft.size > 0;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useBeforeUnloadWarning(dirty);

  /** Faqat foydalanuvchida bor operatsiyalar — yo'q operatsiyani boshqalarga berib bo'lmaydi. */
  const ownedTree = useMemo(
    () => filterAccessTree(treeQ.data ?? [], search, (op) => Boolean(matrixByKey.get(op.key)?.effective)),
    [treeQ.data, search, matrixByKey]
  );
  const ownedKeys = useMemo(() => treeKeys(ownedTree), [ownedTree]);
  const grantedCount = ownedKeys.filter(isOn).length;

  const toggleManage = async () => {
    const next = !hasManage;
    const ok = await confirm({
      title: "Предоставление доступа",
      message: next
        ? "Разрешить пользователю выдавать доступ другим пользователям?"
        : "Запретить пользователю выдавать доступ другим пользователям?",
      detail: next ? "Он сможет выдавать только операции, отмеченные ниже как «может выдавать»." : undefined,
      confirmLabel: next ? "Разрешить" : "Запретить",
      cancelLabel: "Отмена",
      destructive: !next
    });
    if (!ok) return;
    const body = next
      ? { merge_permissions: true, permissions: normalizeAccessGrantPermissions([ACCESS_MANAGE_KEY]), denied_permissions: [] }
      : manageRow?.from_role
        ? { merge_permissions: true, permissions: [], denied_permissions: [ACCESS_MANAGE_KEY] }
        : { remove_permission_keys: [ACCESS_MANAGE_KEY] };
    try {
      await vm.patchMut.mutateAsync(body);
      await vm.detailQ.refetch();
      toast.show({ tone: "ok", text: "Изменения сохранены" });
    } catch (err) {
      toast.show({ tone: "err", text: "Не удалось сохранить изменения", detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.") });
    }
  };

  const save = async () => {
    const allow = [...draft].filter(([, v]) => v).map(([k]) => k);
    const revoke = [...draft].filter(([, v]) => !v).map(([k]) => k);
    setSaving(true);
    try {
      for (let i = 0; i < allow.length; i += CHUNK) await vm.patchMut.mutateAsync({ grant_delegation_allow: allow.slice(i, i + CHUNK) });
      for (let i = 0; i < revoke.length; i += CHUNK) await vm.patchMut.mutateAsync({ grant_delegation_revoke: revoke.slice(i, i + CHUNK) });
      await vm.detailQ.refetch();
      setDraft(new Map());
      toast.show({ tone: "ok", text: "Изменения сохранены" });
    } catch (err) {
      await vm.detailQ.refetch();
      toast.show({ tone: "err", text: "Не удалось сохранить изменения", detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.") });
    } finally {
      setSaving(false);
    }
  };

  if (treeQ.isError) return <PageError message="Не удалось загрузить список операций." onRetry={() => void treeQ.refetch()} />;
  if (treeQ.isLoading || !detail) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <section className="shrink-0 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="deleg-manage-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 id="deleg-manage-title" className="text-sm font-semibold">
              Предоставление доступа другим
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasManage
                ? "Пользователь может открывать раздел «Доступ» и выдавать другим операции, отмеченные ниже."
                : "Пользователь не может выдавать доступ другим."}
              {manageRow?.from_role && hasManage ? " (из роли)" : ""}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hasManage}
            aria-labelledby="deleg-manage-title"
            disabled={manageLocked || vm.patchMut.isPending}
            onClick={() => void toggleManage()}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${hasManage ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-600"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${hasManage ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 bg-card p-3" aria-labelledby="deleg-ops-title">
        <h3 id="deleg-ops-title" className="text-sm font-semibold">
          Может выдавать другим
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Показаны только операции, которые есть у пользователя. Отметка разрешает выдавать эту операцию другим — сама операция при этом не меняется.
          {!hasManage ? " Отметки начнут действовать, когда включено «Предоставление доступа другим»." : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="h-8 pl-8 text-xs" placeholder="Поиск операции" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск операции" />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <GroupCheckbox keys={ownedKeys} isOn={isOn} isDisabled={isDisabled} onToggle={onToggle} label="все операции" />
            Выбрать все
          </label>
          <span className="text-xs text-muted-foreground">
            Может выдавать: <b className="tabular-nums text-foreground">{grantedCount}</b> из {ownedKeys.length}
          </span>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {ownedTree.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {search ? "Ничего не найдено" : "Никаких разрешений не предоставлено"}
            </div>
          ) : (
            <PermissionTree
              tree={ownedTree}
              isOn={isOn}
              onToggle={onToggle}
              isDisabled={isDisabled}
              expanded={expanded}
              onExpandedChange={setExpanded}
              forceExpanded={search.trim().length > 0}
            />
          )}
        </div>
        {dirty ? (
          <AccessUnsavedBar
            added={[...draft.values()].filter(Boolean).length}
            removed={[...draft.values()].filter((v) => !v).length}
            pending={saving}
            onCancel={() => setDraft(new Map())}
            onSave={() => void save()}
          />
        ) : null}
      </section>
      {dialog}
      {toast.node}
    </div>
  );
}
