"use client";

import { ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  filterAccessTree,
  isFlatAccessModule,
  treeKeys,
  type AccessTreeOperation
} from "@/lib/access-operations-tree";
import { useAccessOperationsTree } from "@/components/access/permission-tree/use-access-operations-tree";
import { GroupCheckbox, PermissionTree } from "@/components/access/permission-tree/permission-tree";

export type RoleAddOpCatalogRow = {
  key: string;
  description: string | null;
  parent_path: string;
};

type AccessRoleDefaultsAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  roleName: string;
  catalog: RoleAddOpCatalogRow[];
  grantedKeys: ReadonlySet<string>;
  saving: boolean;
  onSave: (keysToAdd: string[]) => void;
};

export function AccessRoleDefaultsAddModal({
  open,
  onOpenChange,
  tenantSlug,
  roleName,
  catalog,
  grantedKeys,
  saving,
  onSave
}: AccessRoleDefaultsAddModalProps) {
  const [search, setSearch] = useState("");
  const [showSelOnly, setShowSelOnly] = useState(false);
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const treeQ = useAccessOperationsTree(tenantSlug);

  const catalogKeys = useMemo(() => new Set(catalog.map((r) => r.key)), [catalog]);

  const baseTree = useMemo(() => {
    const keep = (op: AccessTreeOperation) => catalogKeys.has(op.key) && !grantedKeys.has(op.key);
    return filterAccessTree(treeQ.data ?? [], "", keep);
  }, [treeQ.data, catalogKeys, grantedKeys]);

  const visibleTree = useMemo(() => {
    const qTree = filterAccessTree(baseTree, search);
    if (!showSelOnly) return qTree;
    return filterAccessTree(qTree, "", (op) => sel.has(op.key));
  }, [baseTree, search, showSelOnly, sel]);

  const flatModuleIds = useMemo(
    () => new Set((treeQ.data ?? []).filter(isFlatAccessModule).map((m) => m.id)),
    [treeQ.data]
  );
  const groupIds = useMemo(
    () => visibleTree.flatMap((m) => [m.id, ...(flatModuleIds.has(m.id) ? [] : m.sections.map((s) => s.id))]),
    [visibleTree, flatModuleIds]
  );
  const visibleKeys = useMemo(() => treeKeys(visibleTree), [visibleTree]);
  const allKeys = useMemo(() => treeKeys(baseTree), [baseTree]);
  const allExpanded = groupIds.length > 0 && groupIds.every((id) => expanded.has(id));
  const searching = search.trim().length > 0;

  const isOn = (key: string) => sel.has(key);
  const onToggle = (keys: string[], next: boolean) =>
    setSel((prev) => {
      const n = new Set(prev);
      for (const k of keys) {
        if (next) n.add(k);
        else n.delete(k);
      }
      return n;
    });

  const handleOpenChange = (next: boolean) => {
    if (!next && saving) return;
    if (!next) {
      setSearch("");
      setShowSelOnly(false);
      setSel(new Set());
      setExpanded(new Set());
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(92vh,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(48rem,calc(100vw-2rem))]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <DialogTitle className="min-w-0 truncate text-[15px] font-normal text-muted-foreground">
            Добавить операции: <span className="font-semibold text-foreground">{roleName}</span>
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => handleOpenChange(false)}
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Операции в том же дереве, что и прикрепление доступа пользователю.
        </DialogDescription>
        <p className="shrink-0 px-4 pt-2 text-[11px] text-muted-foreground">
          Доступно для добавления: {allKeys.length}. Выберите операции — они войдут в состав роли по умолчанию.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs"
            disabled={searching || groupIds.length === 0}
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
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <GroupCheckbox keys={visibleKeys} isOn={isOn} onToggle={onToggle} label="все операции" />
            Выбрать все
          </label>
          <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={showSelOnly} onChange={(e) => setShowSelOnly(e.target.checked)} />
            Показать только выбранные
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {treeQ.isLoading ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">Загрузка дерева операций…</p>
          ) : visibleTree.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {allKeys.length === 0 ? "Все операции из каталога уже входят в роль." : "Ничего не найдено"}
            </p>
          ) : (
            <PermissionTree
              tree={visibleTree}
              isOn={isOn}
              onToggle={onToggle}
              expanded={expanded}
              onExpandedChange={setExpanded}
              forceExpanded={searching}
              countMode="selected"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
          <span className="mr-auto text-xs text-muted-foreground">Выбрано: {sel.size}</span>
          <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => handleOpenChange(false)}>
            Отменить
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-teal-700 text-white hover:bg-teal-800"
            disabled={saving || sel.size === 0}
            onClick={() => onSave([...sel])}
          >
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
