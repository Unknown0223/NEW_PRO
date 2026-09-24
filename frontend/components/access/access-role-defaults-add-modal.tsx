"use client";

import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  buildOpAttachTree,
  collectOpAttachExpandableIds,
  collectOpAttachLeafKeys,
  type OpAttachTreeNode
} from "@/lib/access-op-attach-tree";
import { displayAccessDescriptionShort } from "@/lib/access-display";
import { IndeterminateCheckbox } from "@/components/access/access-user-detail/access-user-detail-territory-ui";
import { shortenPathLabel } from "./access-role-defaults-ops.logic";

export type RoleAddOpCatalogRow = {
  key: string;
  description: string | null;
  parent_path: string;
};

type AccessRoleDefaultsAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleName: string;
  catalog: RoleAddOpCatalogRow[];
  /** Allaqachon rolda bor kalitlar */
  grantedKeys: ReadonlySet<string>;
  saving: boolean;
  onSave: (keysToAdd: string[]) => void;
};

export function AccessRoleDefaultsAddModal({
  open,
  onOpenChange,
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

  const baseItems = useMemo(() => {
    return catalog
      .filter((r) => !grantedKeys.has(r.key))
      .map((r) => ({
        key: r.key,
        label: displayAccessDescriptionShort(r.description, r.key),
        sub: r.key,
        groupKey: (r.parent_path ?? "").trim() || "—"
      }));
  }, [catalog, grantedKeys]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baseItems.filter((it) => {
      if (showSelOnly && !sel.has(it.key)) return false;
      if (!q) return true;
      return `${it.label} ${it.key} ${it.groupKey}`.toLowerCase().includes(q);
    });
  }, [baseItems, search, showSelOnly, sel]);

  const groups = useMemo(() => buildOpAttachTree(filteredItems), [filteredItems]);
  const expandIds = useMemo(() => collectOpAttachExpandableIds(groups), [groups]);
  const allExpanded = expandIds.length > 0 && expandIds.every((id) => expanded.has(id));
  const visibleKeys = useMemo(
    () => groups.flatMap((g) => collectOpAttachLeafKeys(g)),
    [groups]
  );

  const toggleNode = (node: OpAttachTreeNode, checked: boolean) => {
    const keys = collectOpAttachLeafKeys(node);
    setSel((prev) => {
      const n = new Set(prev);
      if (checked) for (const k of keys) n.add(k);
      else for (const k of keys) n.delete(k);
      return n;
    });
  };

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
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-3 overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Добавить операции: {roleName}</DialogTitle>
        </DialogHeader>
        <p className="text-[11px] text-muted-foreground">
          Доступно для добавления: {baseItems.length}. Выберите операции — они войдут в состав роли по
          умолчанию для всех пользователей с этой ролью.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            disabled={expandIds.length === 0}
            onClick={() => {
              if (allExpanded) setExpanded(new Set());
              else setExpanded(new Set(expandIds));
            }}
          >
            {allExpanded ? "Свернуть все" : "Развернуть все"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            disabled={saving || visibleKeys.length === 0}
            onClick={() => setSel(new Set(visibleKeys))}
          >
            Выбрать все
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 text-xs"
            disabled={saving || sel.size === 0}
            onClick={() => setSel(new Set())}
          >
            Снять все
          </Button>
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск"
              className="h-8 w-full pl-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={showSelOnly}
              onChange={(e) => setShowSelOnly(e.target.checked)}
            />
            Показать только выбранные
          </label>
        </div>
        <div className="max-h-[48vh] min-h-0 flex-1 overflow-auto rounded border border-border/60 p-2">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {baseItems.length === 0
                ? "Все операции из каталога уже входят в роль."
                : "Ничего не найдено по фильтру"}
            </p>
          ) : (
            groups.map((grp) => {
              const isOpen = expanded.has(grp.id);
              const leafKeys = collectOpAttachLeafKeys(grp);
              const allOn = leafKeys.length > 0 && leafKeys.every((k) => sel.has(k));
              const someOn = leafKeys.some((k) => sel.has(k)) && !allOn;
              return (
                <div key={grp.id} className="border-b border-border/40 py-1 last:border-b-0">
                  <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold"
                      onClick={() =>
                        setExpanded((prev) => {
                          const n = new Set(prev);
                          if (n.has(grp.id)) n.delete(grp.id);
                          else n.add(grp.id);
                          return n;
                        })
                      }
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate" title={grp.label}>
                        {shortenPathLabel(grp.label)}
                      </span>
                      <span className="shrink-0 font-normal text-muted-foreground">
                        ({grp.leafCount})
                      </span>
                    </button>
                    <IndeterminateCheckbox
                      checked={allOn}
                      indeterminate={someOn}
                      disabled={saving || leafKeys.length === 0}
                      className="h-4 w-4 shrink-0 accent-teal-700"
                      onChange={(e) => toggleNode(grp, e.target.checked)}
                    />
                  </div>
                  {isOpen ? (
                    <div className="mt-0.5 space-y-0 border-l border-border/45 pl-2">
                      {grp.children.map((child) => {
                        const childOpen = expanded.has(child.id);
                        const childKeys = child.items.map((i) => i.key);
                        const childAll =
                          childKeys.length > 0 && childKeys.every((k) => sel.has(k));
                        const childSome =
                          childKeys.some((k) => sel.has(k)) && !childAll;
                        return (
                          <div key={child.id} className="border-b border-border/30 py-0.5 last:border-b-0">
                            <div className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-medium"
                                onClick={() =>
                                  setExpanded((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(child.id)) n.delete(child.id);
                                    else n.add(child.id);
                                    return n;
                                  })
                                }
                              >
                                {childOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="min-w-0 truncate" title={child.label}>
                                  {shortenPathLabel(child.label)}
                                </span>
                                <span className="shrink-0 font-normal text-muted-foreground">
                                  ({child.leafCount})
                                </span>
                              </button>
                              <IndeterminateCheckbox
                                checked={childAll}
                                indeterminate={childSome}
                                disabled={saving || childKeys.length === 0}
                                className="h-4 w-4 shrink-0 accent-teal-700"
                                onChange={(e) => toggleNode(child, e.target.checked)}
                              />
                            </div>
                            {childOpen ? (
                              <div className="mt-0.5 space-y-0 border-l border-border/40 pl-2">
                                {child.items.map((item) => (
                                  <label
                                    key={item.key}
                                    className="flex cursor-pointer items-start gap-2 border-b border-border/25 py-1.5 last:border-b-0"
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-0.5 h-4 w-4 accent-teal-700"
                                      disabled={saving}
                                      checked={sel.has(item.key)}
                                      onChange={(e) => {
                                        setSel((prev) => {
                                          const n = new Set(prev);
                                          if (e.target.checked) n.add(item.key);
                                          else n.delete(item.key);
                                          return n;
                                        });
                                      }}
                                    />
                                    <span className="min-w-0 text-xs leading-snug">
                                      <span className="font-medium text-foreground">{item.label}</span>
                                      <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">
                                        {item.sub}
                                      </span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {grp.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex cursor-pointer items-start gap-2 border-b border-border/25 py-1.5 last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-teal-700"
                            disabled={saving}
                            checked={sel.has(item.key)}
                            onChange={(e) => {
                              setSel((prev) => {
                                const n = new Set(prev);
                                if (e.target.checked) n.add(item.key);
                                else n.delete(item.key);
                                return n;
                              });
                            }}
                          />
                          <span className="min-w-0 text-xs leading-snug">
                            <span className="font-medium text-foreground">{item.label}</span>
                            <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">
                              {item.sub}
                            </span>
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
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => handleOpenChange(false)}
          >
            Отменить
          </Button>
          <Button
            type="button"
            disabled={saving || sel.size === 0}
            className="bg-teal-700 text-white hover:bg-teal-800"
            onClick={() => onSave([...sel])}
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
