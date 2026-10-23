"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import {
  AgentRestrictionsPanelShell,
  AgentTemplateModal,
  agentModalBtnCancelTemplate,
  agentModalBtnSaveGradient
} from "@/components/staff/agent-workspace-template-ui";
import type { AgentEntitlementSavePayload } from "@/components/staff/agent-restrictions-dialog";

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

function productKey(categoryId: number, productId: number) {
  return `${categoryId}:${productId}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  tenant: string;
  initial: AgentEntitlementSavePayload;
  priceTypes: string[];
  priceTypeLabels?: Record<string, string>;
  bulkMode?: boolean;
  bulkCount?: number;
  bulkLabel?: string;
  mixedHint?: boolean;
  loadError?: string | null;
  onSave: (ent: AgentEntitlementSavePayload) => void | Promise<void>;
};

/** Редактор entitlements для рабочего места (типы цен + продукты). */
export function SlotEntitlementsEditor({
  open,
  onClose,
  tenant,
  initial,
  priceTypes,
  priceTypeLabels,
  bulkMode = false,
  bulkCount = 0,
  bulkLabel,
  mixedHint = false,
  loadError = null,
  onSave
}: Props) {
  const [ptSel, setPtSel] = useState<string[]>([]);
  const [prodChecked, setProdChecked] = useState<Record<string, boolean>>({});
  const [categoryAll, setCategoryAll] = useState<Set<number>>(new Set());
  const [ptSearch, setPtSearch] = useState("");
  const [prSearch, setPrSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenant, "slot-entitlements"],
    enabled: open && Boolean(tenant),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: ProductCategoryRow[] }>(
        `/api/${tenant}/product-categories`
      );
      return data.data.filter((c) => c.is_active);
    }
  });

  const categories = categoriesQ.data ?? [];

  const productQueries = useQueries({
    queries: categories.map((c) => ({
      queryKey: ["products-by-cat", tenant, c.id, "slot-entitlements"],
      enabled: open && Boolean(tenant),
      staleTime: STALE.reference,
      queryFn: async () => {
        const { data } = await api.get<{ data: ProductListItem[] }>(
          `/api/${tenant}/products?category_id=${c.id}&limit=2000&is_active=true`
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
    const pts = new Set(initial.price_types ?? []);
    setPtSel(Array.from(pts));

    const pc: Record<string, boolean> = {};
    const allCats = new Set<number>();
    for (const rule of initial.product_rules ?? []) {
      if (rule.all) allCats.add(rule.category_id);
      else if (rule.product_ids?.length) {
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
    setSaveError(null);
    setSaving(false);
  }, [initial]);

  const initialKey = useMemo(
    () =>
      JSON.stringify({
        price_types: [...(initial.price_types ?? [])].sort(),
        product_rules: (initial.product_rules ?? []).map((r) => ({
          category_id: r.category_id,
          all: Boolean(r.all),
          product_ids: [...(r.product_ids ?? [])].sort((a, b) => a - b)
        }))
      }),
    [initial]
  );

  // Saqlangan belgilar kelishi bilan draft yangilanadi (dialog doim mount).
  useEffect(() => {
    if (!open) {
      return;
    }
    resetDraft();
    // resetDraft `initial` reference o‘zgarsa ham qayta ishlamasin — faqat mazmun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const ptLabel = useCallback(
    (key: string) => priceTypeLabels?.[key] ?? key,
    [priceTypeLabels]
  );

  const filteredPt = useMemo(() => {
    const extra = (initial.price_types ?? []).filter((p) => !priceTypes.includes(p));
    const keys = [...priceTypes, ...extra];
    return keys.filter((p) => {
      const s = ptSearch.toLowerCase();
      return p.toLowerCase().includes(s) || ptLabel(p).toLowerCase().includes(s);
    });
  }, [priceTypes, ptSearch, ptLabel, initial.price_types]);

  const allPtSelected =
    filteredPt.length > 0 && filteredPt.every((p) => ptSel.includes(p));

  const toggleAllPriceTypes = () => {
    if (allPtSelected) {
      setPtSel((prev) => prev.filter((p) => !filteredPt.includes(p)));
    } else {
      setPtSel((prev) => Array.from(new Set([...prev, ...filteredPt])));
    }
  };

  const categoryMatchesSearch = useCallback(
    (c: ProductCategoryRow) => {
      const q = prSearch.trim().toLowerCase();
      if (!q) return true;
      if (c.name.toLowerCase().includes(q)) return true;
      const items = productsByCategory.get(c.id) ?? [];
      return items.some((p) => p.name.toLowerCase().includes(q));
    },
    [prSearch, productsByCategory]
  );

  const categoryHasSelection = useCallback(
    (c: ProductCategoryRow) => {
      if (categoryAll.has(c.id)) return true;
      const prefix = `${c.id}:`;
      if (Object.keys(prodChecked).some((k) => k.startsWith(prefix) && prodChecked[k])) return true;
      const items = productsByCategory.get(c.id) ?? [];
      return items.some((p) => prodChecked[productKey(c.id, p.id)]);
    },
    [categoryAll, prodChecked, productsByCategory]
  );

  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      autoExpandedRef.current = false;
      return;
    }
    if (autoExpandedRef.current || productsLoading || categories.length === 0) return;
    const names = categories.filter(categoryHasSelection).map((c) => c.name);
    if (names.length > 0 && names.length <= 3) setExpanded(names);
    autoExpandedRef.current = true;
  }, [open, productsLoading, categories, categoryHasSelection]);

  const visibleCategories = useMemo(() => {
    const list = categories.filter(categoryMatchesSearch);
    return [...list].sort((a, b) => {
      const as = categoryHasSelection(a) ? 0 : 1;
      const bs = categoryHasSelection(b) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [categories, categoryMatchesSearch, categoryHasSelection]);

  const isCategoryFullySelected = useCallback(
    (c: ProductCategoryRow) => {
      const items = productsByCategory.get(c.id) ?? [];
      const sel = items.filter((p) => prodChecked[productKey(c.id, p.id)]).length;
      return categoryAll.has(c.id) || (items.length > 0 && sel === items.length);
    },
    [categoryAll, prodChecked, productsByCategory]
  );

  const allProductsSelected =
    visibleCategories.length > 0 && visibleCategories.every(isCategoryFullySelected);

  const toggleAllProducts = () => {
    if (allProductsSelected) {
      setCategoryAll((prev) => {
        const next = new Set(prev);
        for (const c of visibleCategories) next.delete(c.id);
        return next;
      });
      setProdChecked((prev) => {
        const next = { ...prev };
        for (const c of visibleCategories) {
          for (const p of productsByCategory.get(c.id) ?? []) {
            delete next[productKey(c.id, p.id)];
          }
        }
        return next;
      });
      return;
    }
    setCategoryAll((prev) => {
      const next = new Set(prev);
      for (const c of visibleCategories) next.add(c.id);
      return next;
    });
    setProdChecked((prev) => {
      const next = { ...prev };
      for (const c of visibleCategories) {
        for (const p of productsByCategory.get(c.id) ?? []) {
          next[productKey(c.id, p.id)] = true;
        }
      }
      return next;
    });
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
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.resolve(onSave({ price_types: ptSel, product_rules: buildRules() }));
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const chipCount = bulkMode ? bulkCount : 1;
  const chipLabel = bulkMode
    ? (bulkLabel ?? `Выбрано мест: ${bulkCount}`)
    : "Ограничения рабочего места";

  const ptCountLabel = `${ptSel.filter((p) => filteredPt.includes(p) || priceTypes.includes(p)).length}/${Math.max(priceTypes.length, ptSel.length)}`;
  const prodSelectedCount = categories.filter(categoryHasSelection).length;
  const prodCountLabel = `${prodSelectedCount}/${categories.length}`;

  return (
    <AgentTemplateModal
      title={bulkMode ? "Групповые ограничения" : "Ограничения места"}
      onClose={onClose}
      width="max-w-3xl"
    >
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50 to-emerald-50/60 px-3.5 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm text-white shadow-sm">
          {chipCount > 1 ? chipCount : "⚙"}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-teal-600">
            {bulkMode ? "Рабочие места" : "Место"}
          </p>
          <p className="truncate text-sm font-semibold text-slate-800">{chipLabel}</p>
        </div>
      </div>

      {mixedHint ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          У выбранных мест настройки отличаются — показаны все отмеченные значения.
        </p>
      ) : null}
      {loadError ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AgentRestrictionsPanelShell
          icon="💰"
          title="Тип цены"
          countLabel={ptCountLabel}
          onToggleAll={toggleAllPriceTypes}
          allSelected={allPtSelected}
          search={ptSearch}
          onSearchChange={setPtSearch}
          listClassName="max-h-[32rem] overflow-y-scroll"
        >
          {filteredPt.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-400">Нет типов цен</p>
          ) : (
            filteredPt.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-teal-600"
                  checked={ptSel.includes(item)}
                  onChange={() =>
                    setPtSel((prev) =>
                      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
                    )
                  }
                />
                {ptLabel(item)}
              </label>
            ))
          )}
        </AgentRestrictionsPanelShell>

        <AgentRestrictionsPanelShell
          icon="📦"
          title="Продукт"
          countLabel={prodCountLabel}
          onToggleAll={toggleAllProducts}
          allSelected={allProductsSelected}
          search={prSearch}
          onSearchChange={setPrSearch}
          listClassName="max-h-[32rem] overflow-y-scroll"
        >
          {categoriesQ.isLoading ? (
            <p className="p-4 text-center text-xs text-slate-400">Загрузка…</p>
          ) : visibleCategories.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-400">Нет категорий</p>
          ) : (
            <>
            {visibleCategories.map((c) => (
              <CategoryRow
                key={c.id}
                category={c}
                products={productsByCategory.get(c.id) ?? []}
                prSearch={prSearch}
                expanded={expanded}
                onToggleExpand={(name) =>
                  setExpanded((e) => (e.includes(name) ? e.filter((x) => x !== name) : [...e, name]))
                }
                categoryAll={categoryAll}
                prodChecked={prodChecked}
                onToggleCategory={() => {
                  const items = productsByCategory.get(c.id) ?? [];
                  const sel = items.filter((p) => prodChecked[productKey(c.id, p.id)]).length;
                  const all = categoryAll.has(c.id) || (items.length > 0 && sel === items.length);
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
                }}
                onToggleProduct={(productId) => {
                  const k = productKey(c.id, productId);
                  setProdChecked((prev) => {
                    const next = { ...prev };
                    if (next[k]) delete next[k];
                    else next[k] = true;
                    return next;
                  });
                  setCategoryAll((prev) => {
                    const n = new Set(prev);
                    n.delete(c.id);
                    return n;
                  });
                }}
              />
            ))}
            {visibleCategories.length > 7 ? (
              <p className="px-2 py-1.5 text-[11px] text-slate-400">
                Прокрутите список, чтобы увидеть все категории
              </p>
            ) : null}
            </>
          )}
        </AgentRestrictionsPanelShell>
      </div>

      {saveError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className={agentModalBtnCancelTemplate}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={agentModalBtnSaveGradient}
        >
          {saving ? "…" : "Применить"}
        </button>
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
  categoryAll,
  prodChecked,
  onToggleCategory,
  onToggleProduct
}: {
  category: ProductCategoryRow;
  products: ProductListItem[];
  prSearch: string;
  expanded: string[];
  onToggleExpand: (name: string) => void;
  categoryAll: Set<number>;
  prodChecked: Record<string, boolean>;
  onToggleCategory: () => void;
  onToggleProduct: (productId: number) => void;
}) {
  const cbRef = useRef<HTMLInputElement>(null);
  const extraSelected = Object.keys(prodChecked)
    .filter((k) => k.startsWith(`${category.id}:`) && prodChecked[k])
    .map((k) => Number(k.slice(String(category.id).length + 1)))
    .filter((id) => Number.isInteger(id) && id > 0 && !products.some((p) => p.id === id));
  const mergedProducts =
    extraSelected.length === 0
      ? products
      : [
          ...products,
          ...extraSelected.map((id) => ({
            id,
            name: `ID ${id}`,
            sku: "",
            category_id: category.id
          }))
        ];
  const isOpen = expanded.includes(category.name) || prSearch.trim() !== "";
  const visibleItems = prSearch.trim()
    ? mergedProducts.filter((p) => p.name.toLowerCase().includes(prSearch.trim().toLowerCase()))
    : mergedProducts;
  const selCount = mergedProducts.filter((p) => prodChecked[productKey(category.id, p.id)]).length;
  const all =
    categoryAll.has(category.id) || (mergedProducts.length > 0 && selCount === mergedProducts.length);
  const some = (selCount > 0 || extraSelected.length > 0) && !all;
  const selected = all || some || categoryAll.has(category.id);

  useLayoutEffect(() => {
    const el = cbRef.current;
    if (el) el.indeterminate = some;
  }, [some, all]);

  return (
    <div
      className={
        selected
          ? "overflow-hidden rounded-lg border border-teal-200 bg-teal-50/40"
          : "overflow-hidden rounded-lg border border-slate-100"
      }
    >
      <div
        className="flex cursor-pointer items-center gap-2 px-2 py-1.5"
        onClick={() => onToggleExpand(category.name)}
      >
        <input
          ref={cbRef}
          type="checkbox"
          className="accent-teal-600"
          checked={all}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleCategory}
        />
        <span className="flex-1 truncate text-sm font-medium">{category.name}</span>
        {all ? (
          <span className="text-[10px] font-semibold uppercase text-teal-700">все</span>
        ) : selCount > 0 ? (
          <span className="text-[10px] font-semibold text-teal-700">{selCount}</span>
        ) : null}
      </div>
      {isOpen ? (
        <div className="space-y-0.5 py-1 pl-6">
          {visibleItems.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                className="accent-teal-600"
                checked={
                  categoryAll.has(category.id) ||
                  Boolean(prodChecked[productKey(category.id, item.id)])
                }
                onChange={() => onToggleProduct(item.id)}
              />
              {item.name}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
