"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessUnsavedBar, useAccessToast } from "@/components/access/permission-tree/access-save-bar";
import { api } from "@/lib/api";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";
import {
  userMessageAfterAccessPatchFailure,
  type AccessTerritoriesCatalog,
  type AccessTerritoryTreeNode,
  type TerritoryApiRow
} from "./access-user-detail.types";
import { TerritoryReferenceTreeRows } from "./access-user-detail-territory-ui";

export function sameIdSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

export function countIdDelta(base: Set<string>, next: Set<string>): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const id of next) if (!base.has(id)) added += 1;
  for (const id of base) if (!next.has(id)) removed += 1;
  return { added, removed };
}

function subtreeSelected(node: AccessTerritoryTreeNode, sel: Set<string>): boolean {
  if (sel.has(String(node.id))) return true;
  return (node.children ?? []).some((c) => subtreeSelected(c, sel));
}

function filterSelectedTree(nodes: AccessTerritoryTreeNode[], sel: Set<string>): AccessTerritoryTreeNode[] {
  return nodes.flatMap((n) => {
    if (!subtreeSelected(n, sel)) return [];
    return [{ ...n, children: filterSelectedTree(n.children ?? [], sel) }];
  });
}

function filterNamedTree(nodes: AccessTerritoryTreeNode[], q: string): AccessTerritoryTreeNode[] {
  if (!q) return nodes;
  return nodes.flatMap((n) => {
    const children = filterNamedTree(n.children ?? [], q);
    const hit = n.name.toLocaleLowerCase("ru").includes(q) || (n.code ?? "").toLocaleLowerCase("ru").includes(q);
    if (!hit && children.length === 0) return [];
    return [{ ...n, children: hit ? n.children ?? [] : children }];
  });
}

function expandIdsFor(nodes: AccessTerritoryTreeNode[], sel: Set<string>, out = new Set<number>()): Set<number> {
  for (const n of nodes) {
    const kids = n.children ?? [];
    if (kids.some((c) => subtreeSelected(c, sel))) out.add(n.id);
    expandIdsFor(kids, sel, out);
  }
  return out;
}

/** Территории: зона → область → город. Галочка сама не сохраняется — нужна кнопка. */
export function TerritoryScopeTree({ vm, readOnly, hint }: { vm: AccessUserDetailVm; readOnly: boolean; hint: string }) {
  const catalogQ = useQuery({
    queryKey: ["access-territories", vm.tenantSlug],
    queryFn: async (): Promise<AccessTerritoriesCatalog> => {
      const { data } = await api.get<{ data?: TerritoryApiRow[]; tree?: AccessTerritoryTreeNode[] }>(
        `/api/${vm.tenantSlug}/access/territories`
      );
      return { flat: data.data ?? [], tree: data.tree ?? [] };
    },
    staleTime: 30_000
  });
  const attached = useMemo(
    () => new Set((vm.detailQ.data?.scope?.territories ?? []).map(String)),
    [vm.detailQ.data?.scope?.territories]
  );
  const [sel, setSel] = useState<Set<string>>(attached);
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const expandedMark = useRef("");
  const attachedRef = useRef(attached);
  attachedRef.current = attached;
  const toast = useAccessToast();
  const attachedKey = useMemo(() => [...attached].sort().join(","), [attached]);

  useEffect(() => {
    setSel(new Set(attachedRef.current));
  }, [attachedKey]);

  useEffect(() => {
    const tree = catalogQ.data?.tree;
    if (!tree?.length || vm.userId <= 0 || !vm.detailQ.data) return;
    const mark = `${vm.userId}:${attachedKey}`;
    if (expandedMark.current === mark) return;
    expandedMark.current = mark;
    setExpanded(expandIdsFor(tree, attachedRef.current));
  }, [catalogQ.data?.tree, attachedKey, vm.userId, vm.detailQ.data]);

  const tree = useMemo(() => {
    const base = catalogQ.data?.tree ?? [];
    const picked = onlySelected ? filterSelectedTree(base, sel) : base;
    return filterNamedTree(picked, search.trim().toLocaleLowerCase("ru"));
  }, [catalogQ.data?.tree, onlySelected, sel, search]);

  const dirty = !sameIdSet(sel, attached);
  const delta = countIdDelta(attached, sel);

  const save = async () => {
    const ids = [...sel].map(Number).filter((n) => Number.isInteger(n) && n > 0);
    try {
      await vm.patchMut.mutateAsync({ territory_ids: ids });
      toast.show({ tone: "ok", text: "Территории сохранены" });
    } catch (err) {
      toast.show({
        tone: "err",
        text: "Не удалось сохранить территории",
        detail: userMessageAfterAccessPatchFailure(err, "Попробуйте ещё раз.")
      });
    }
  };

  const empty = (catalogQ.data?.tree.length ?? 0) === 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="h-8 pl-8 text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск территории" />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
          Только прикреплённые
        </label>
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        {hint} Зона отмечает область и город. Отметьте галочкой и нажмите «Сохранить». Прикреплено:{" "}
        <b className="tabular-nums text-foreground">{sel.size}</b>
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border/60 p-2">
        {catalogQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : catalogQ.isError ? (
          <p className="py-10 text-center text-sm text-destructive">Не удалось загрузить территории.</p>
        ) : empty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Нет территорий. Добавьте дерево в Настройки → Территория.</p>
        ) : tree.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {onlySelected ? "Территории не прикреплены." : "Ничего не найдено"}
          </p>
        ) : (
          <TerritoryReferenceTreeRows
            nodes={tree}
            depth={0}
            treeExpanded={expanded}
            setTreeExpanded={setExpanded}
            modalSel={sel}
            setModalSel={setSel}
            territoryDisabled={readOnly || vm.patchMut.isPending}
          />
        )}
      </div>
      {dirty && !readOnly ? (
        <AccessUnsavedBar
          added={delta.added}
          removed={delta.removed}
          pending={vm.patchMut.isPending}
          onCancel={() => setSel(new Set(attached))}
          onSave={() => void save()}
        />
      ) : null}
      {toast.node}
    </div>
  );
}
