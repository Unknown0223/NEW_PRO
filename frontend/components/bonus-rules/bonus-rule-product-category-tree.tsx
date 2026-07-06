"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";

import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { BonusRuleTemplateCheckbox } from "@/components/bonus-rules/bonus-rule-form-fields";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProductCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number | null;
};

type ProductRow = {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
};

type TreeNode = ProductCategoryRow & { children: TreeNode[] };

export const UNCATEGORIZED_KEY = "__uncategorized__" as const;

const checkboxCls = "mt-0.5 h-4 w-4 shrink-0 rounded border border-input accent-primary";

function TreeCheckbox({
  checked,
  muted,
  disabled,
  onChange,
  id
}: {
  checked: boolean;
  muted?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  id?: string;
}) {
  if (onChange) {
    return (
      <BonusRuleTemplateCheckbox
        id={id}
        checked={checked}
        muted={muted}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  return <input id={id} type="checkbox" className={checkboxCls} checked={checked} disabled={disabled} readOnly />;
}

function nestCategories(flat: ProductCategoryRow[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const c of flat) {
    const node = map.get(c.id)!;
    if (c.parent_id != null && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const so = (a.sort_order ?? 1e6) - (b.sort_order ?? 1e6);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name, "uz");
    });
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

function addCategoryAncestors(
  catId: number,
  flat: ProductCategoryRow[],
  into: Set<number>
): void {
  into.add(catId);
  const row = flat.find((c) => c.id === catId);
  if (row?.parent_id != null) addCategoryAncestors(row.parent_id, flat, into);
}

function addCategoryDescendants(
  catId: number,
  flat: ProductCategoryRow[],
  into: Set<number>
): void {
  into.add(catId);
  for (const c of flat) {
    if (c.parent_id === catId) addCategoryDescendants(c.id, flat, into);
  }
}

/** Kategoriya va barcha ichki kategoriyalardagi faol mahsulot id lari. */
export async function fetchProductIdsForCategorySubtree(
  tenantSlug: string,
  categoryId: number,
  flat: ProductCategoryRow[],
  search = ""
): Promise<number[]> {
  const catIds = new Set<number>();
  addCategoryDescendants(categoryId, flat, catIds);
  const productIds: number[] = [];
  for (const cid of catIds) {
    const p = new URLSearchParams({ is_active: "true", category_id: String(cid) });
    const s = search.trim();
    if (s) p.set("search", s);
    const rows = await fetchAllActiveProductsPage(tenantSlug, p);
    productIds.push(...rows.map((r) => r.id));
  }
  return [...new Set(productIds)];
}

function filterTreeByVisibleCategories(nodes: TreeNode[], visible: Set<number>): TreeNode[] {
  const out: TreeNode[] = [];
  for (const n of nodes) {
    if (!visible.has(n.id)) continue;
    out.push({
      ...n,
      children: filterTreeByVisibleCategories(n.children, visible)
    });
  }
  return out;
}

export async function fetchAllActiveProductsPage(
  tenantSlug: string,
  params: URLSearchParams
): Promise<ProductRow[]> {
  const out: ProductRow[] = [];
  let page = 1;
  const limit = 100;
  for (;;) {
    params.set("page", String(page));
    params.set("limit", String(limit));
    const { data } = await api.get<{ data: ProductRow[]; total: number }>(
      `/api/${tenantSlug}/products?${params.toString()}`
    );
    out.push(...data.data);
    if (out.length >= data.total || data.data.length === 0) break;
    page += 1;
  }
  return out;
}

function SelectAllCheckbox({
  inputId,
  allSelected,
  someSelected,
  onChange,
  disabled
}: {
  inputId: string;
  allSelected: boolean;
  someSelected: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.indeterminate = someSelected;
  }, [someSelected]);
  return (
    <input
      ref={ref}
      id={inputId}
      type="checkbox"
      className={checkboxCls}
      checked={allSelected}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

type CategoryProductsPanelProps = {
  tenantSlug: string;
  categoryKey: number | typeof UNCATEGORIZED_KEY;
  selected: Set<number>;
  onToggleProduct: (id: number, checked: boolean) => void;
  /** Kategoriya ichidagi barcha id lar uchun bitta yangilanish */
  onToggleCategoryIds: (ids: number[], checked: boolean) => void;
  depth: number;
  /** Form yuborilayotganda */
  disabled?: boolean;
  /** Faqat ko‘rish (masalan trigger: assortiment o‘chiq) */
  selectionDisabled?: boolean;
  search?: string;
  /** React Query instance (ikki ustun bir vaqtda) */
  querySuffix?: string;
  /** Qulflangan qoida: faqat tanlangan mahsulotlar */
  visibleProductIds?: Set<number>;
};

function CategoryProductsPanel({
  tenantSlug,
  categoryKey,
  selected,
  onToggleProduct,
  onToggleCategoryIds,
  depth,
  disabled = false,
  selectionDisabled = false,
  search = "",
  querySuffix = "tree",
  visibleProductIds
}: CategoryProductsPanelProps) {
  const searchTrim = search.trim();
  const q = useQuery({
    queryKey: ["bonus-rule-scope-products", querySuffix, tenantSlug, categoryKey, searchTrim],
    queryFn: async () => {
      const p = new URLSearchParams({ is_active: "true" });
      if (categoryKey === UNCATEGORIZED_KEY) {
        p.set("uncategorized", "true");
      } else {
        p.set("category_id", String(categoryKey));
      }
      if (searchTrim) p.set("search", searchTrim);
      return fetchAllActiveProductsPage(tenantSlug, p);
    },
    staleTime: STALE.list,
    enabled: Boolean(tenantSlug)
  });

  const ids = useMemo(() => q.data?.map((x) => x.id) ?? [], [q.data]);
  const rows = useMemo(() => {
    const data = q.data ?? [];
    if (!visibleProductIds?.size) return data;
    return data.filter((p) => visibleProductIds.has(p.id));
  }, [q.data, visibleProductIds]);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id)) && !allSelected;
  const checkDis = disabled || selectionDisabled;
  const readOnlyList = Boolean(visibleProductIds?.size) && selectionDisabled;

  const toggleAll = (checked: boolean) => {
    onToggleCategoryIds(ids, checked);
  };

  if (q.isLoading) {
    return (
      <div className={cn("py-2 text-sm text-muted-foreground", depth > 0 && "pl-6")}>Загрузка…</div>
    );
  }
  if (q.isError) {
    return (
      <div className={cn("py-2 text-sm text-destructive", depth > 0 && "pl-6")}>Mahsulotlarni yuklab bo‘lmadi.</div>
    );
  }
  if (!rows.length) {
    return (
      <div className={cn("py-2 text-sm text-muted-foreground", depth > 0 && "pl-6")}>
        {searchTrim ? "Qidiruv bo‘yicha mahsulot yo‘q." : "Bu kategoriyada mahsulot yo‘q."}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1 border-l border-border/60 py-1", depth > 0 && "ml-3 pl-3")}>
      {!readOnlyList ? (
      <div className="flex items-center gap-2 py-1">
        <SelectAllCheckbox
          inputId={`br-cat-all-${querySuffix}-${String(categoryKey)}`}
          allSelected={allSelected}
          someSelected={someSelected}
          onChange={toggleAll}
          disabled={checkDis}
        />
        <Label
          htmlFor={`br-cat-all-${querySuffix}-${String(categoryKey)}`}
          className="cursor-pointer text-xs text-muted-foreground"
        >
          Выбрать все ({q.data?.length ?? 0})
        </Label>
      </div>
      ) : null}
      <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50">
            <TreeCheckbox
              id={`br-prod-${querySuffix}-${p.id}`}
              checked={selected.has(p.id)}
              disabled={checkDis}
              onChange={(checked) => onToggleProduct(p.id, checked)}
            />
            <Label
              htmlFor={`br-prod-${querySuffix}-${p.id}`}
              className="flex-1 cursor-pointer text-sm font-normal leading-tight"
            >
              <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
              <span className="mx-1">—</span>
              {p.name}
            </Label>
          </li>
        ))}
      </ul>
    </div>
  );
}

type CategoryNodeProps = {
  tenantSlug: string;
  node: TreeNode;
  depth: number;
  selected: Set<number>;
  onToggleProduct: (id: number, checked: boolean) => void;
  onToggleCategoryIds: (ids: number[], checked: boolean) => void;
  categoryScopeSelected?: Set<number>;
  onToggleCategoryScope?: (categoryId: number, checked: boolean) => void;
  expanded: Set<number>;
  toggleExpanded: (id: number) => void;
  disabled?: boolean;
  selectionDisabled?: boolean;
  search?: string;
  querySuffix?: string;
  allowExpandWhenDisabled?: boolean;
  visibleProductIds?: Set<number>;
  /** Kategoriya checkbox — ichidagi barcha mahsulotlarni tanlaydi (KPI va h.k.) */
  categoryCheckSelectsProducts?: boolean;
  flatCategories?: ProductCategoryRow[];
};

function CategoryNode({
  tenantSlug,
  node,
  depth,
  selected,
  onToggleProduct,
  onToggleCategoryIds,
  categoryScopeSelected,
  onToggleCategoryScope,
  expanded,
  toggleExpanded,
  disabled = false,
  selectionDisabled = false,
  search = "",
  querySuffix = "tree",
  allowExpandWhenDisabled = false,
  visibleProductIds,
  categoryCheckSelectsProducts = false,
  flatCategories = []
}: CategoryNodeProps) {
  const isOpen = expanded.has(node.id);
  const categoryPickEnabled = Boolean(onToggleCategoryScope && categoryScopeSelected);
  const categoryChecked = categoryScopeSelected?.has(node.id) ?? false;
  const expandDisabled = disabled && !allowExpandWhenDisabled;
  const searchTrim = search.trim();

  const subtreeIdsQ = useQuery({
    queryKey: ["category-subtree-product-ids", tenantSlug, node.id, searchTrim, querySuffix],
    enabled: categoryCheckSelectsProducts && Boolean(tenantSlug) && flatCategories.length > 0,
    queryFn: () => fetchProductIdsForCategorySubtree(tenantSlug, node.id, flatCategories, searchTrim),
    staleTime: STALE.list
  });
  const subtreeIds = subtreeIdsQ.data ?? [];
  const subtreeAllSelected = subtreeIds.length > 0 && subtreeIds.every((id) => selected.has(id));
  const subtreeSomeSelected = subtreeIds.some((id) => selected.has(id)) && !subtreeAllSelected;

  return (
    <div className={cn(depth > 0 && "ml-2 border-l border-border/40 pl-2")}>
      <div className="flex min-h-11 items-center gap-2 px-1 py-2">
        {categoryCheckSelectsProducts ? (
          <SelectAllCheckbox
            inputId={`br-cat-scope-${querySuffix}-${node.id}`}
            allSelected={subtreeAllSelected}
            someSelected={subtreeSomeSelected}
            disabled={disabled || selectionDisabled || subtreeIdsQ.isLoading || subtreeIds.length === 0}
            onChange={(checked) => onToggleCategoryIds(subtreeIds, checked)}
          />
        ) : categoryPickEnabled ? (
          <TreeCheckbox
            checked={categoryChecked}
            disabled={disabled || selectionDisabled}
            onChange={(checked) => onToggleCategoryScope!(node.id, checked)}
          />
        ) : null}
        <button
          type="button"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/40 disabled:opacity-50"
          onClick={() => toggleExpanded(node.id)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Свернуть" : "Развернуть"}
          disabled={expandDisabled}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline disabled:opacity-50"
          onClick={() => toggleExpanded(node.id)}
          disabled={expandDisabled}
        >
          {node.name}
        </button>
      </div>
      {isOpen ? (
        <div className="pb-2">
          {node.children.length > 0 ? (
            <div className="mt-1 space-y-1">
              {node.children.map((ch) => (
                <CategoryNode
                  key={ch.id}
                  tenantSlug={tenantSlug}
                  node={ch}
                  depth={depth + 1}
                  selected={selected}
                  onToggleProduct={onToggleProduct}
                  onToggleCategoryIds={onToggleCategoryIds}
                  categoryScopeSelected={categoryScopeSelected}
                  onToggleCategoryScope={onToggleCategoryScope}
                  expanded={expanded}
                  toggleExpanded={toggleExpanded}
                  disabled={disabled}
                  selectionDisabled={selectionDisabled}
                  search={search}
                  querySuffix={querySuffix}
                  allowExpandWhenDisabled={allowExpandWhenDisabled}
                  visibleProductIds={visibleProductIds}
                  categoryCheckSelectsProducts={categoryCheckSelectsProducts}
                  flatCategories={flatCategories}
                />
              ))}
            </div>
          ) : null}
          <div className={node.children.length > 0 ? "mt-2" : ""}>
            <CategoryProductsPanel
              tenantSlug={tenantSlug}
              categoryKey={node.id}
              selected={selected}
              onToggleProduct={onToggleProduct}
              onToggleCategoryIds={onToggleCategoryIds}
              depth={depth + 1}
              disabled={disabled}
              selectionDisabled={selectionDisabled}
              search={search}
              querySuffix={querySuffix}
              visibleProductIds={visibleProductIds}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type BonusRuleProductCategoryTreeProps = {
  tenantSlug: string;
  value: number[];
  onChange: (productIds: number[]) => void;
  /** «Kategoriya» rejimi: tanlangan kategoriya ID lari (`product_category_ids`) */
  categoryScopeIds?: number[];
  onCategoryScopeChange?: (categoryIds: number[]) => void;
  /** Saqlash kutilayotganda */
  disabled?: boolean;
  /** Ro‘yxat ochiladi, lekin belgilash o‘chiriladi */
  selectionDisabled?: boolean;
  /** Nom / SKU bo‘yicha (API `search`) */
  search?: string;
  className?: string;
  querySuffix?: string;
  /** Mahsulot belgisi o‘zgarmasidan oldin (masalan kategoriya filtrini tozalash) */
  onSelectionIntent?: () => void;
  /** Qulflangan qoida: faqat tanlangan kategoriya/mahsulotlar */
  restrictToSelection?: boolean;
  /** `disabled` bo‘lsa ham kategoriyani ochish/yopish */
  allowExpandWhenDisabled?: boolean;
  /** Dialog ochilganda barcha kategoriyalarni yoyish (mahsulotlar darhol ko‘rinadi) */
  defaultExpandAll?: boolean;
  /** Kategoriya checkbox — ichidagi barcha mahsulotlarni tanlaydi */
  categoryCheckSelectsProducts?: boolean;
};

/**
 * Faol mahsulotlar: kategoriya — ochiladi/yopiladi; mahsulotlar — checkbox.
 */
export function BonusRuleProductCategoryTree({
  tenantSlug,
  value,
  onChange,
  categoryScopeIds,
  onCategoryScopeChange,
  disabled = false,
  selectionDisabled = false,
  search = "",
  className,
  querySuffix = "tree",
  onSelectionIntent,
  restrictToSelection = false,
  allowExpandWhenDisabled = false,
  defaultExpandAll = false,
  categoryCheckSelectsProducts = false
}: BonusRuleProductCategoryTreeProps) {
  const selected = useMemo(() => new Set(value), [value]);
  const categoryScopeSelected = useMemo(
    () => new Set(categoryScopeIds ?? []),
    [categoryScopeIds]
  );
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());
  const [uncOpen, setUncOpen] = useState(false);

  const catsQ = useQuery({
    // querySuffix emas — ikki ustun bir xil ro‘yxatni ikkilan yuklamasligi uchun
    queryKey: ["product-categories", tenantSlug, "bonus-rule-tree"],
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductCategoryRow[] }>(`/api/${tenantSlug}/product-categories`);
      return data.data;
    },
    staleTime: STALE.reference,
    enabled: Boolean(tenantSlug)
  });

  const tree = useMemo(() => nestCategories(catsQ.data ?? []), [catsQ.data]);

  const scopeOnlyCategories =
    restrictToSelection && (categoryScopeIds?.length ?? 0) > 0 && value.length === 0;

  const visibleProductIds = useMemo(() => {
    if (!restrictToSelection || scopeOnlyCategories) return undefined;
    if (value.length === 0) return undefined;
    return new Set(value);
  }, [restrictToSelection, scopeOnlyCategories, value]);

  const filterProductsQ = useQuery({
    queryKey: ["bonus-rule-locked-products", tenantSlug, value.join(",")],
    enabled: Boolean(tenantSlug) && restrictToSelection && value.length > 0,
    staleTime: STALE.list,
    queryFn: async () => {
      const all = await fetchAllActiveProductsPage(
        tenantSlug,
        new URLSearchParams({ is_active: "true" })
      );
      const want = new Set(value);
      return all.filter((p) => want.has(p.id));
    }
  });

  const lockedProductRows = useMemo(() => filterProductsQ.data ?? [], [filterProductsQ.data]);

  const visibleCategoryIdsResolved = useMemo(() => {
    if (!restrictToSelection) return null;
    const flat = catsQ.data ?? [];
    if (!flat.length) return new Set<number>();
    const visible = new Set<number>();
    for (const id of categoryScopeIds ?? []) {
      addCategoryDescendants(id, flat, visible);
    }
    for (const p of lockedProductRows) {
      if (p.category_id != null) addCategoryAncestors(p.category_id, flat, visible);
    }
    return visible;
  }, [restrictToSelection, catsQ.data, categoryScopeIds, lockedProductRows]);

  const displayTree = useMemo(() => {
    if (!restrictToSelection) return tree;
    if (!visibleCategoryIdsResolved?.size) return [];
    return filterTreeByVisibleCategories(tree, visibleCategoryIdsResolved);
  }, [tree, restrictToSelection, visibleCategoryIdsResolved]);

  const showUncategorizedSection = useMemo(() => {
    if (!restrictToSelection) return true;
    return lockedProductRows.some((p) => p.category_id == null);
  }, [restrictToSelection, lockedProductRows]);

  useLayoutEffect(() => {
    if (!restrictToSelection || !visibleCategoryIdsResolved?.size) return;
    setExpandedCats(new Set(visibleCategoryIdsResolved));
    if (showUncategorizedSection) setUncOpen(true);
  }, [restrictToSelection, visibleCategoryIdsResolved, showUncategorizedSection]);

  useLayoutEffect(() => {
    if (!defaultExpandAll) return;
    const flat = catsQ.data ?? [];
    if (!flat.length) return;
    const allIds = new Set(flat.map((c) => c.id));
    setExpandedCats(allIds);
    setUncOpen(true);
  }, [defaultExpandAll, catsQ.data]);

  /**
   * Qidiruv bo‘yicha natijani ko‘rish uchun kategoriyalarni ochish.
   * `tree` ni dependency qilmaslik kerak — har safar yangi referens bo‘lib, effekt qayta ishlab
   * foydalanuvchi yopgan tugunlarni qayta ochardi (trigger «ishlamayapti» taassuroti).
   * Bir xil qidiruv uchun faqat bir marta avto-ochamiz; qidiruv o‘zgaganda qayta.
   */
  const lastAutoExpandForSearchRef = useRef<string>("");
  useEffect(() => {
    const q = search.trim();
    if (!q) {
      lastAutoExpandForSearchRef.current = "";
      return;
    }
    const data = catsQ.data ?? [];
    if (!data.length) return;

    if (lastAutoExpandForSearchRef.current === q) return;
    lastAutoExpandForSearchRef.current = q;

    const t = nestCategories(data);
    setExpandedCats((prev) => {
      const next = new Set(prev);
      const walk = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          next.add(n.id);
          if (n.children.length) walk(n.children);
        }
      };
      walk(t);
      return next;
    });
    setUncOpen(true);
  }, [search, catsQ.data]);

  const toggleExpanded = (id: number) => {
    setExpandedCats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onToggleProduct = (id: number, checked: boolean) => {
    if (selectionDisabled) return;
    onSelectionIntent?.();
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const onToggleCategoryIds = (ids: number[], checked: boolean) => {
    if (selectionDisabled) return;
    onSelectionIntent?.();
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  const onToggleCategoryScope = (categoryId: number, checked: boolean) => {
    if (!onCategoryScopeChange || selectionDisabled) return;
    const next = new Set(categoryScopeSelected);
    if (checked) next.add(categoryId);
    else next.delete(categoryId);
    onCategoryScopeChange(Array.from(next).sort((a, b) => a - b));
  };

  if (!tenantSlug) return null;

  if (catsQ.isLoading) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">Kategoriyalar yuklanmoqda…</p>;
  }
  if (catsQ.isError) {
    return <p className="px-1 py-4 text-sm text-destructive">Kategoriyalarni yuklab bo‘lmadi.</p>;
  }

  if (restrictToSelection && filterProductsQ.isLoading && value.length > 0) {
    return <p className="px-1 py-4 text-sm text-muted-foreground">Tanlangan mahsulotlar yuklanmoqda…</p>;
  }

  return (
    <div className={cn("pr-1", className)}>
      {displayTree.length === 0 && restrictToSelection ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">Tanlangan kategoriya yoki mahsulot yo‘q.</p>
      ) : null}
      {displayTree.map((n, index) => (
        <div key={n.id} className={cn(index > 0 && "border-t border-border/70")}>
        <CategoryNode
          tenantSlug={tenantSlug}
          node={n}
          depth={0}
          selected={selected}
          onToggleProduct={onToggleProduct}
          onToggleCategoryIds={onToggleCategoryIds}
          categoryScopeSelected={onCategoryScopeChange ? categoryScopeSelected : undefined}
          onToggleCategoryScope={onCategoryScopeChange ? onToggleCategoryScope : undefined}
          expanded={expandedCats}
          toggleExpanded={toggleExpanded}
          disabled={disabled}
          selectionDisabled={selectionDisabled}
          search={search}
          querySuffix={querySuffix}
          allowExpandWhenDisabled={allowExpandWhenDisabled}
          visibleProductIds={visibleProductIds}
          categoryCheckSelectsProducts={categoryCheckSelectsProducts}
          flatCategories={catsQ.data ?? []}
        />
        </div>
      ))}

      {showUncategorizedSection ? (
      <div className="border-t border-border/70 pt-1">
        <div className="flex items-center gap-2 px-1 py-2.5">
          <button
            type="button"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/40 disabled:opacity-50"
            onClick={() => setUncOpen((v) => !v)}
            aria-expanded={uncOpen}
            aria-label={uncOpen ? "Свернуть" : "Развернуть"}
            disabled={disabled && !allowExpandWhenDisabled}
          >
            {uncOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="flex-1 truncate text-left text-sm font-medium hover:underline disabled:opacity-50"
            onClick={() => setUncOpen((v) => !v)}
            disabled={disabled && !allowExpandWhenDisabled}
          >
            Kategoriyasiz mahsulotlar
          </button>
        </div>
        {uncOpen ? (
          <CategoryProductsPanel
            tenantSlug={tenantSlug}
            categoryKey={UNCATEGORIZED_KEY}
            selected={selected}
            onToggleProduct={onToggleProduct}
            onToggleCategoryIds={onToggleCategoryIds}
            depth={0}
            disabled={disabled}
            selectionDisabled={selectionDisabled}
            search={search}
            querySuffix={querySuffix}
            visibleProductIds={visibleProductIds}
          />
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
