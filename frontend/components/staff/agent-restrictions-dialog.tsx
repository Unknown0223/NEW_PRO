"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  AgentTemplateModal,
  agentModalBtnCancelTemplate,
  agentModalBtnSaveGradient
} from "@/components/staff/agent-workspace-template-ui";

type AgentRestrictionsSource = {
  fio: string;
  price_type: string | null;
  price_types: string[];
  agent_entitlements: {
    price_types?: string[];
    product_rules?: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
  };
};

type ProductCategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  is_active: boolean;
};

type ProductListItem = {
  id: number;
  name: string;
  sku: string;
  category_id: number | null;
};

export type AgentEntitlementSavePayload = {
  price_types: string[];
  product_rules: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
};

function productKey(categoryId: number, productId: number) {
  return `${categoryId}:${productId}`;
}

function parseProductKey(key: string): { categoryId: number; productId: number } | null {
  const [catRaw, prodRaw] = key.split(":");
  const categoryId = Number.parseInt(catRaw ?? "", 10);
  const productId = Number.parseInt(prodRaw ?? "", 10);
  if (!Number.isFinite(categoryId) || categoryId <= 0) return null;
  if (!Number.isFinite(productId) || productId <= 0) return null;
  return { categoryId, productId };
}

type Props = {
  open: boolean;
  agent: AgentRestrictionsSource | null;
  bulkMode?: boolean;
  bulkCount?: number;
  bulkLabel?: string;
  onClose: () => void;
  tenantSlug: string;
  categories: ProductCategoryRow[];
  categoriesLoading?: boolean;
  priceTypes: string[];
  onSave: (ent: AgentEntitlementSavePayload) => Promise<unknown>;
};

/** Shablon RestrictionsModal bilan 100% bir xil UI (SALEC API saqlanadi). */
export function AgentRestrictionsDialog({
  open,
  agent,
  bulkMode = false,
  bulkCount = 0,
  bulkLabel,
  onClose,
  tenantSlug,
  categories,
  categoriesLoading = false,
  priceTypes,
  onSave
}: Props) {
  const [ptSel, setPtSel] = useState<string[]>([]);
  const [prodChecked, setProdChecked] = useState<Record<string, boolean>>({});
  const [categoryAll, setCategoryAll] = useState<Set<number>>(new Set());
  const [ptSearch, setPtSearch] = useState("");
  const [prSearch, setPrSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const productQueries = useQueries({
    queries: categories.map((c) => ({
      queryKey: ["products-by-cat", tenantSlug, c.id, "restrictions-dialog"],
      enabled: open && Boolean(tenantSlug),
      staleTime: STALE.reference,
      queryFn: async () => {
        const { data } = await api.get<{ data: ProductListItem[] }>(
          `/api/${tenantSlug}/products?category_id=${c.id}&limit=500&is_active=true`
        );
        return data.data;
      }
    }))
  });

  const productsByCategory = useMemo(() => {
    const map = new Map<number, ProductListItem[]>();
    categories.forEach((c, i) => {
      map.set(c.id, productQueries[i]?.data ?? []);
    });
    return map;
  }, [categories, productQueries]);

  const productsLoading = productQueries.some((q) => q.isLoading);

  const resetDraft = useCallback(() => {
    setPtSel([]);
    setProdChecked({});
    setCategoryAll(new Set());
    setPtSearch("");
    setPrSearch("");
    setExpanded([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (bulkMode) {
      resetDraft();
      return;
    }
    if (!agent) return;

    const pts = new Set(
      agent.price_types?.length ? agent.price_types : agent.price_type ? [agent.price_type] : []
    );
    (agent.agent_entitlements?.price_types ?? []).forEach((p) => pts.add(p));
    setPtSel(Array.from(pts));

    const pc: Record<string, boolean> = {};
    const allCats = new Set<number>();
    for (const rule of agent.agent_entitlements?.product_rules ?? []) {
      if (rule.all) {
        allCats.add(rule.category_id);
      } else if (rule.product_ids?.length) {
        for (const pid of rule.product_ids) {
          pc[productKey(rule.category_id, pid)] = true;
        }
      }
    }
    setProdChecked(pc);
    setCategoryAll(allCats);
    setPtSearch("");
    setPrSearch("");
    setExpanded([]);
  }, [open, agent, bulkMode, resetDraft]);

  const filteredPt = useMemo(
    () => priceTypes.filter((p) => p.toLowerCase().includes(ptSearch.toLowerCase())),
    [priceTypes, ptSearch]
  );

  const allProductItems = useMemo(() => {
    let n = 0;
    for (const prods of productsByCategory.values()) n += prods.length;
    return n;
  }, [productsByCategory]);

  const selectedProductCount = useMemo(() => {
    let n = 0;
    const countedCats = new Set<number>();
    for (const [k, on] of Object.entries(prodChecked)) {
      if (!on) continue;
      const parsed = parseProductKey(k);
      if (!parsed) continue;
      n += 1;
      countedCats.add(parsed.categoryId);
    }
    for (const catId of categoryAll) {
      if (countedCats.has(catId)) continue;
      n += productsByCategory.get(catId)?.length ?? 0;
    }
    return n;
  }, [prodChecked, categoryAll, productsByCategory]);

  const filteredCategories = useMemo(() => {
    const q = prSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => {
        if (c.name.toLowerCase().includes(q)) return c;
        const items = (productsByCategory.get(c.id) ?? []).filter((p) =>
          p.name.toLowerCase().includes(q)
        );
        return items.length ? c : null;
      })
      .filter((c): c is ProductCategoryRow => c !== null);
  }, [categories, prSearch, productsByCategory]);

  const togglePt = (item: string) => {
    setPtSel((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const toggleExpand = (name: string) => {
    setExpanded((e) => (e.includes(name) ? e.filter((x) => x !== name) : [...e, name]));
  };

  const categoryState = (c: ProductCategoryRow) => {
    const items = productsByCategory.get(c.id) ?? [];
    if (categoryAll.has(c.id) && items.length > 0) {
      const sel = items.filter((p) => prodChecked[productKey(c.id, p.id)]).length;
      if (sel === 0 || sel === items.length) return { all: true, some: false };
    }
    if (items.length === 0) {
      const on = categoryAll.has(c.id);
      return { all: on, some: on };
    }
    const sel = items.filter((p) => prodChecked[productKey(c.id, p.id)]).length;
    return { all: sel === items.length && items.length > 0, some: sel > 0 };
  };

  const toggleCategory = (c: ProductCategoryRow) => {
    const items = productsByCategory.get(c.id) ?? [];
    const { all } = categoryState(c);
    setCategoryAll((prev) => {
      const n = new Set(prev);
      if (all) n.delete(c.id);
      else n.add(c.id);
      return n;
    });
    setProdChecked((prev) => {
      const next = { ...prev };
      for (const p of items) {
        const k = productKey(c.id, p.id);
        if (all) delete next[k];
        else next[k] = true;
      }
      return next;
    });
  };

  const toggleProduct = (categoryId: number, productId: number) => {
    const k = productKey(categoryId, productId);
    setProdChecked((prev) => {
      const next = { ...prev };
      if (next[k]) delete next[k];
      else next[k] = true;
      return next;
    });
    setCategoryAll((prev) => {
      const n = new Set(prev);
      n.delete(categoryId);
      return n;
    });
  };

  const selectAllProducts = () => {
    if (selectedProductCount >= allProductItems && allProductItems > 0) {
      setProdChecked({});
      setCategoryAll(new Set());
      return;
    }
    const next: Record<string, boolean> = {};
    const all = new Set<number>();
    for (const c of categories) {
      const items = productsByCategory.get(c.id) ?? [];
      if (items.length === 0) {
        all.add(c.id);
        continue;
      }
      for (const p of items) next[productKey(c.id, p.id)] = true;
    }
    setProdChecked(next);
    setCategoryAll(all);
  };

  const buildRules = (): AgentEntitlementSavePayload["product_rules"] => {
    const out: AgentEntitlementSavePayload["product_rules"] = [];
    for (const c of categories) {
      const items = productsByCategory.get(c.id) ?? [];
      const ids = items.filter((p) => prodChecked[productKey(c.id, p.id)]).map((p) => p.id);
      if (categoryAll.has(c.id) && ids.length === 0) {
        out.push({ category_id: c.id, all: true });
        continue;
      }
      if (items.length > 0 && ids.length === items.length) {
        out.push({ category_id: c.id, all: true });
        continue;
      }
      if (ids.length > 0) {
        out.push({ category_id: c.id, all: false, product_ids: ids });
      }
    }
    return out;
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        price_types: ptSel,
        product_rules: buildRules()
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  if (!bulkMode && !agent) return null;

  const chipCount = bulkMode ? bulkCount : 1;
  const chipLabel = bulkMode
    ? (bulkLabel ?? `Выбрано агентов: ${bulkCount}`)
    : (agent?.fio ?? "");

  return (
    <AgentTemplateModal title="Ограничения" onClose={onClose} width="max-w-3xl">
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50/60 px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm text-white shadow-sm">
          {chipCount > 1 ? chipCount : "👤"}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal-600">
            {chipCount > 1 ? "Агенты" : "Агент"}
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">{chipLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Тип цены */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">💳</span>
              <h4 className="text-sm font-semibold text-slate-800">Тип цены</h4>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                {ptSel.length}/{priceTypes.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setPtSel(ptSel.length === priceTypes.length ? [] : [...priceTypes])
              }
              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline"
            >
              {ptSel.length === priceTypes.length ? "Снять все" : "Выбрать все"}
            </button>
          </div>
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                🔍
              </span>
              <input
                placeholder="Поиск..."
                value={ptSearch}
                onChange={(e) => setPtSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
          </div>
          <div className="max-h-64 flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {filteredPt.map((item) => {
              const checked = ptSel.includes(item);
              return (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    checked
                      ? "bg-teal-50 font-medium text-teal-800"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={checked}
                    onChange={() => togglePt(item)}
                  />
                  {item}
                  {checked ? <span className="ml-auto text-xs text-teal-500">✓</span> : null}
                </label>
              );
            })}
            {filteredPt.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">Ничего не найдено</p>
            ) : null}
          </div>
        </div>

        {/* Продукт */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <h4 className="text-sm font-semibold text-slate-800">Продукт</h4>
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-700">
                {selectedProductCount}/{allProductItems || "…"}
              </span>
            </div>
            <button
              type="button"
              onClick={selectAllProducts}
              disabled={categoriesLoading || productsLoading}
              className="text-[11px] font-medium text-teal-600 hover:text-teal-800 hover:underline disabled:opacity-50"
            >
              {selectedProductCount >= allProductItems && allProductItems > 0
                ? "Снять все"
                : "Выбрать все"}
            </button>
          </div>
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                🔍
              </span>
              <input
                placeholder="Поиск..."
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-500/15"
              />
            </div>
          </div>
          <div className="max-h-64 flex-1 space-y-1 overflow-y-auto p-1.5">
            {categoriesLoading || productsLoading ? (
              <p className="p-4 text-center text-xs text-slate-400">Загрузка…</p>
            ) : filteredCategories.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400">Ничего не найдено</p>
            ) : (
              filteredCategories.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  products={productsByCategory.get(c.id) ?? []}
                  prSearch={prSearch}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  categoryState={categoryState(c)}
                  prodChecked={prodChecked}
                  onToggleCategory={() => toggleCategory(c)}
                  onToggleProduct={(productId) => toggleProduct(c.id, productId)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          Выбрано: <b className="text-teal-700">{ptSel.length}</b> тип цены ·{" "}
          <b className="text-teal-700">{selectedProductCount}</b> товаров
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={agentModalBtnCancelTemplate}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={agentModalBtnSaveGradient}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </AgentTemplateModal>
  );
}

function CategoryRow({
  category,
  products,
  prSearch,
  expanded,
  onToggleExpand,
  categoryState,
  prodChecked,
  onToggleCategory,
  onToggleProduct
}: {
  category: ProductCategoryRow;
  products: ProductListItem[];
  prSearch: string;
  expanded: string[];
  onToggleExpand: (name: string) => void;
  categoryState: { all: boolean; some: boolean };
  prodChecked: Record<string, boolean>;
  onToggleCategory: () => void;
  onToggleProduct: (productId: number) => void;
}) {
  const cbRef = useRef<HTMLInputElement>(null);
  const st = categoryState;
  const isOpen = expanded.includes(category.name) || prSearch.trim() !== "";
  const visibleItems = prSearch.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(prSearch.trim().toLowerCase()))
    : products;
  const selCount = products.filter((p) => prodChecked[productKey(category.id, p.id)]).length;

  useLayoutEffect(() => {
    const el = cbRef.current;
    if (el) el.indeterminate = !st.all && st.some;
  }, [st.all, st.some]);

  return (
    <div
      className={`overflow-hidden rounded-lg border transition-colors ${
        st.some ? "border-teal-200 bg-teal-50/40" : "border-slate-100 bg-white"
      }`}
    >
      <div
        className={`flex cursor-pointer items-center gap-2.5 px-2.5 py-2 transition-colors hover:bg-teal-50/60 ${
          isOpen ? "border-b border-teal-100/60" : ""
        }`}
        onClick={() => onToggleExpand(category.name)}
      >
        <input
          ref={cbRef}
          type="checkbox"
          className="h-4 w-4 accent-teal-600"
          checked={st.all}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleCategory}
        />
        <span className="flex-1 truncate text-sm font-semibold text-slate-800">{category.name}</span>
        {selCount > 0 ? (
          <span className="rounded-full bg-teal-600 px-1.5 py-px text-[10px] font-bold text-white">
            {selCount}
          </span>
        ) : null}
        <span className="rounded-md bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">
          {products.length}
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] text-slate-400 shadow-sm ring-1 ring-slate-200 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-teal-600 ring-teal-200" : ""
          }`}
        >
          ▾
        </span>
      </div>
      {isOpen ? (
        <div className="space-y-0.5 bg-white/60 py-1 pl-3 pr-1.5">
          {visibleItems.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-400">Нет товаров в категории</p>
          ) : (
            visibleItems.map((item) => {
              const checked = Boolean(prodChecked[productKey(category.id, item.id)]);
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors ${
                    checked ? "font-medium text-teal-800" : "text-slate-600 hover:bg-slate-50"
                  }`}
                  style={{
                    borderLeft: checked ? "2px solid #0d9488" : "2px solid #e2e8f0"
                  }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={checked}
                    onChange={() => onToggleProduct(item.id)}
                  />
                  {item.name}
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
