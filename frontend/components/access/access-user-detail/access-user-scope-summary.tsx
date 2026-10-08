"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CreditCard, MapPin, Pencil, Plus, Route, Search, Users, Warehouse, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { accessRoleLabel } from "@/lib/access-role-label";
import type { AccessUserDetailVm } from "./hooks/use-access-user-detail-panel";
import {
  userMessageAfterAccessPatchFailure,
  type AccessTerritoriesCatalog,
  type AccessTerritoryTreeNode,
  type DetailModalKind,
  type DimRow,
  type TerritoryApiRow
} from "./access-user-detail.types";
import { TerritoryReferenceTreeRows } from "./access-user-detail-territory-ui";
import type { AccessUserDetailTab } from "./access-user-detail-header";

type ScopeTab = Extract<AccessUserDetailTab, "territories" | "branches" | "cash_desks" | "payment_methods" | "warehouses" | "trade_directions" | "staff">;

const SCOPE_META: Record<ScopeTab, { modal: DetailModalKind; icon: LucideIcon; hint: string; empty: string }> = {
  territories: {
    modal: "territory",
    icon: MapPin,
    hint: "Клиенты и заказы каких территорий видит пользователь.",
    empty: "Территории не прикреплены — ограничение по территориям не действует."
  },
  staff: {
    modal: "staff",
    icon: Users,
    hint: "Сотрудники (агенты, экспедиторы и др.), данные которых видит пользователь.",
    empty: "Сотрудники не прикреплены."
  },
  cash_desks: { modal: "cash", icon: Wallet, hint: "С какими кассами пользователь может работать.", empty: "Кассы не прикреплены." },
  warehouses: { modal: "warehouse", icon: Warehouse, hint: "С какими складами пользователь может работать.", empty: "Склады не прикреплены." },
  branches: { modal: "branch", icon: Building2, hint: "В каких филиалах пользователь может работать.", empty: "Филиалы не прикреплены." },
  payment_methods: { modal: "payment", icon: CreditCard, hint: "Какие способы оплаты доступны пользователю.", empty: "Способы оплаты не прикреплены." },
  trade_directions: { modal: "direction", icon: Route, hint: "Направления торговли, доступные пользователю.", empty: "Направления не прикреплены." }
};

export function isAccessScopeTab(tab: AccessUserDetailTab): tab is ScopeTab {
  return tab in SCOPE_META;
}

type Item = { id: string; label: string; sub?: string };

function useScopeLabels(tenantSlug: string, tab: ScopeTab) {
  const dimType = tab === "territories" || tab === "staff" ? null : tab;
  const territoriesQ = useQuery({
    queryKey: ["access-scope-territory-names", tenantSlug],
    enabled: tab === "territories",
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data?: TerritoryApiRow[] }>(`/api/${tenantSlug}/access/territories`);
      return new Map((data.data ?? []).map((r) => [String(r.id), r.label || r.name] as const));
    }
  });
  const dimQ = useQuery({
    queryKey: ["access-scope-dim-names", tenantSlug, dimType],
    enabled: dimType != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: DimRow[] }>(`/api/${tenantSlug}/access/dimensions?type=${dimType}`);
      return new Map((data.data ?? []).map((r) => [String(r.key), r.label] as const));
    }
  });
  return tab === "territories" ? territoriesQ : dimQ;
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

/** Территории: зона → область → город, belgi butun pastki shoxni oladi. */
function TerritoryScopeTree({ vm, readOnly, hint }: { vm: AccessUserDetailVm; readOnly: boolean; hint: string }) {
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
  const saveTimer = useRef<number | null>(null);
  const expandedForUser = useRef<number | null>(null);

  useEffect(() => {
    setSel(attached);
  }, [attached]);

  useEffect(() => {
    const tree = catalogQ.data?.tree;
    if (!tree?.length || vm.userId <= 0 || !vm.detailQ.data) return;
    if (expandedForUser.current === vm.userId) return;
    expandedForUser.current = vm.userId;
    setExpanded(expandIdsFor(tree, attached));
  }, [catalogQ.data?.tree, attached, vm.userId, vm.detailQ.data]);

  const tree = useMemo(() => {
    const base = catalogQ.data?.tree ?? [];
    const picked = onlySelected ? filterSelectedTree(base, sel) : base;
    return filterNamedTree(picked, search.trim().toLocaleLowerCase("ru"));
  }, [catalogQ.data?.tree, onlySelected, sel, search]);

  const setAndSave: Dispatch<SetStateAction<Set<string>>> = (next) => {
    setSel((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const ids = [...value].map(Number).filter((n) => Number.isInteger(n) && n > 0);
        void vm.patchMut.mutateAsync({ territory_ids: ids }).catch((err) => {
          setSel(attached);
          vm.setBulkFeedback({
            tone: "err",
            text: userMessageAfterAccessPatchFailure(err, "Не удалось сохранить территории")
          });
        });
      }, 400);
      return value;
    });
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
        {hint} Зона отмечает область и город. Прикреплено: <b className="tabular-nums text-foreground">{sel.size}</b>
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
            setModalSel={setAndSave}
            territoryDisabled={readOnly || vm.patchMut.isPending}
          />
        )}
      </div>
    </div>
  );
}

/** Hudud tablari: biriktirilgan obyektlar nomi bilan + tanlash oynasini ochish. */
export function AccessUserScopeSummary({ vm, tab, readOnly }: { vm: AccessUserDetailVm; tab: ScopeTab; readOnly: boolean }) {
  const meta = SCOPE_META[tab];
  const Icon = meta.icon;
  const detail = vm.detailQ.data;
  const labelsQ = useScopeLabels(vm.tenantSlug, tab);
  const [search, setSearch] = useState("");

  const items = useMemo((): Item[] => {
    if (tab === "staff") {
      return (detail?.supervisees ?? []).map((s) => ({
        id: String(s.id),
        label: `${s.code ? `[${s.code}] ` : ""}${s.name || s.login}`,
        sub: accessRoleLabel(s.role)
      }));
    }
    const scope = detail?.scope;
    const ids: (string | number)[] =
      tab === "territories"
        ? scope?.territories ?? []
        : tab === "branches"
          ? scope?.branches ?? []
          : tab === "cash_desks"
            ? scope?.cash_desks ?? []
            : tab === "payment_methods"
              ? scope?.payment_methods ?? []
              : tab === "warehouses"
                ? scope?.warehouses ?? []
                : scope?.trade_directions ?? [];
    const names = labelsQ.data;
    return ids
      .map((raw) => {
        const id = String(raw);
        return { id, label: names?.get(id) ?? (typeof raw === "number" ? `#${id}` : id) };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [tab, detail, labelsQ.data]);

  const q = search.trim().toLocaleLowerCase("ru");
  const shown = q ? items.filter((i) => i.label.toLocaleLowerCase("ru").includes(q) || i.sub?.toLocaleLowerCase("ru").includes(q)) : items;
  const loadingNames = tab !== "staff" && items.length > 0 && labelsQ.isLoading;

  if (tab === "territories") return <TerritoryScopeTree vm={vm} readOnly={readOnly} hint={meta.hint} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="h-8 pl-8 text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Поиск" />
        </div>
        {!readOnly ? (
          <Button type="button" size="sm" className="h-8 gap-1 bg-teal-700 text-xs text-white hover:bg-teal-800" onClick={() => vm.openModal(meta.modal)}>
            {items.length > 0 ? <Pencil className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {items.length > 0 ? "Изменить" : "Прикрепить"}
          </Button>
        ) : null}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground">
        {meta.hint}
        {items.length > 0 ? (
          <>
            {" "}
            Прикреплено: <b className="tabular-nums text-foreground">{items.length}</b>
          </>
        ) : null}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {loadingNames ? (
          <div className="space-y-1.5" aria-busy="true">
            {Array.from({ length: Math.min(items.length, 6) }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
            </span>
            <p className="max-w-sm text-sm font-medium text-muted-foreground">{meta.empty}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((i) => (
              <li key={i.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-[13px]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate" title={i.label}>
                  {i.label}
                </span>
                {i.sub ? <span className="shrink-0 rounded bg-muted px-1.5 text-[10.5px] text-muted-foreground">{i.sub}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
