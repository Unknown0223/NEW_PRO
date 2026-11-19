"use client";

/**
 * OrderCreateDraft catalog — qty/categories/estimatedSum/stock flags (ADR-008 M1.4).
 */
import type { ProductRow } from "@/lib/product-types";
import { useEffect, useMemo } from "react";
import {
  computeCategoryIdsWithPositiveStock,
  computeEstimatedSum,
  computeHasMissingPriceForSelected,
  computeHasQtyOverStock,
  computeLineProblemCountByCategoryId,
  computeMissingPriceProductNames,
  computeSelectedItemsCount,
  computeSelectedTotalQty,
  computeTotalVolumeM3,
  filterCatalogProducts
} from "./draft.logic";
import type { StockRow } from "./draft.logic";

export type DraftCatalogArgs = {
  products: ProductRow[];
  categories: { id: number; name: string }[];
  selectedCategoryIds: number[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<number[]>>;
  activeCatalogCategoryId: number | null;
  setActiveCatalogCategoryId: React.Dispatch<React.SetStateAction<number | null>>;
  warehouseId: string;
  stockProductIdsKey: string;
  stockQ: {
    data: StockRow[] | undefined;
    isSuccess: boolean;
    isError: boolean;
  };
  editReservedQtyByProduct: Record<number, number>;
  qtyByProductId: Record<number, string>;
  priceType: string;
  oldPriceByProductId?: Record<number, string> | null;
  productSearch: string;
  isEditMode: boolean;
  editSourceWarehouseId: number | null;
  selectedWarehouseIdNum: number;
};

export function useOrderCreateDraftCatalog(args: DraftCatalogArgs) {
  const {
    products,
    categories,
    selectedCategoryIds,
    setSelectedCategoryIds,
    activeCatalogCategoryId,
    setActiveCatalogCategoryId,
    warehouseId,
    stockProductIdsKey,
    stockQ,
    editReservedQtyByProduct,
    qtyByProductId,
    priceType,
    oldPriceByProductId,
    productSearch,
    isEditMode,
    editSourceWarehouseId,
    selectedWarehouseIdNum
  } = args;

  const categoryFilterSet = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);
  const categoryFilterActive = categoryFilterSet.size > 0;

  useEffect(() => {
    if (selectedCategoryIds.length === 0) {
      setActiveCatalogCategoryId(null);
      return;
    }
    setActiveCatalogCategoryId((cur) =>
      cur != null && selectedCategoryIds.includes(cur) ? cur : selectedCategoryIds[0]!
    );
  }, [selectedCategoryIds, setActiveCatalogCategoryId]);

  const catalogProducts = useMemo(
    () =>
      filterCatalogProducts({
        products,
        categoryFilterActive,
        categoryFilterSet,
        warehouseId,
        stockRows: stockQ.data,
        editReservedQtyByProduct,
        qtyByProductId
      }),
    [
      products,
      categoryFilterActive,
      categoryFilterSet,
      warehouseId,
      stockQ.data,
      editReservedQtyByProduct,
      qtyByProductId
    ]
  );

  const categoryIdsWithPositiveStock = useMemo(
    () =>
      computeCategoryIdsWithPositiveStock({
        products,
        warehouseId,
        stockProductIdsKey,
        stockReady: stockQ.isSuccess,
        stockRows: stockQ.data,
        editReservedQtyByProduct,
        qtyByProductId
      }),
    [
      products,
      warehouseId,
      stockProductIdsKey,
      stockQ.isSuccess,
      stockQ.data,
      editReservedQtyByProduct,
      qtyByProductId
    ]
  );

  const categoriesWithWarehouseSellableStock = useMemo(() => {
    if (!warehouseId.trim() || !stockProductIdsKey) return categories;
    if (stockQ.isError) return [];
    if (!stockQ.isSuccess) return null;
    if (categoryIdsWithPositiveStock == null) return null;
    return categories.filter((c) => categoryIdsWithPositiveStock.has(c.id));
  }, [
    categories,
    warehouseId,
    stockProductIdsKey,
    stockQ.isSuccess,
    stockQ.isError,
    categoryIdsWithPositiveStock
  ]);

  const lineProblemCountByCategoryId = useMemo(
    () =>
      computeLineProblemCountByCategoryId({
        products,
        warehouseId,
        stockRows: stockQ.data,
        qtyByProductId,
        priceType,
        oldPriceByProductId
      }),
    [products, warehouseId, stockQ.data, qtyByProductId, priceType, oldPriceByProductId]
  );

  useEffect(() => {
    if (categoryIdsWithPositiveStock == null) return;
    setSelectedCategoryIds((prev) => {
      const next = prev.filter((id) => categoryIdsWithPositiveStock.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [categoryIdsWithPositiveStock, setSelectedCategoryIds]);

  const productSearchNorm = productSearch.trim().toLowerCase();
  const displayProducts = useMemo(() => {
    if (!productSearchNorm) return catalogProducts;
    return catalogProducts.filter((p) => {
      const n = p.name.toLowerCase();
      const sku = (p.sku ?? "").toLowerCase();
      return n.includes(productSearchNorm) || sku.includes(productSearchNorm);
    });
  }, [catalogProducts, productSearchNorm]);

  const displayProductGroups = useMemo(() => {
    if (displayProducts.length === 0) return [];
    const byId = new Map<number, ProductRow[]>();
    const uncategorized: ProductRow[] = [];
    for (const p of displayProducts) {
      const cid = p.category_id;
      if (cid == null || !Number.isFinite(cid)) {
        uncategorized.push(p);
        continue;
      }
      const arr = byId.get(cid) ?? [];
      arr.push(p);
      byId.set(cid, arr);
    }
    const known = new Set(categories.map((c) => c.id));
    const out: { key: string; categoryName: string; products: ProductRow[] }[] = [];
    for (const c of categories) {
      const prows = byId.get(c.id);
      if (!prows?.length) continue;
      out.push({ key: `c-${c.id}`, categoryName: c.name, products: prows });
    }
    for (const [cid, prows] of byId) {
      if (known.has(cid)) continue;
      out.push({ key: `o-${cid}`, categoryName: `Категория #${cid}`, products: prows });
    }
    if (uncategorized.length > 0) {
      out.push({ key: "none", categoryName: "Без категории", products: uncategorized });
    }
    return out;
  }, [displayProducts, categories]);

  const catalogTabMode = selectedCategoryIds.length > 0;
  const tableProductGroups = useMemo(() => {
    if (!catalogTabMode) return displayProductGroups;
    const aid = activeCatalogCategoryId ?? selectedCategoryIds[0]!;
    const cat = categories.find((c) => c.id === aid);
    const name = cat?.name ?? `Категория #${aid}`;
    const prows = displayProducts.filter((p) => p.category_id === aid);
    return [{ key: `tab-${aid}`, categoryName: name, products: prows }];
  }, [
    catalogTabMode,
    displayProductGroups,
    displayProducts,
    activeCatalogCategoryId,
    selectedCategoryIds,
    categories
  ]);

  const sameWhForStock =
    isEditMode &&
    editSourceWarehouseId != null &&
    selectedWarehouseIdNum === editSourceWarehouseId;

  const hasQtyOverStock = useMemo(
    () =>
      computeHasQtyOverStock({
        catalogProducts,
        qtyByProductId,
        stockRows: stockQ.data,
        sameWarehouseAsEdit: Boolean(sameWhForStock),
        editReservedQtyByProduct
      }),
    [catalogProducts, qtyByProductId, stockQ.data, sameWhForStock, editReservedQtyByProduct]
  );

  const hasMissingPriceForSelected = useMemo(
    () =>
      computeHasMissingPriceForSelected({
        catalogProducts,
        qtyByProductId,
        priceType,
        oldPriceByProductId
      }),
    [catalogProducts, qtyByProductId, priceType, oldPriceByProductId]
  );

  const missingPriceProductNames = useMemo(
    () =>
      computeMissingPriceProductNames({
        catalogProducts,
        qtyByProductId,
        priceType,
        oldPriceByProductId
      }),
    [catalogProducts, qtyByProductId, priceType, oldPriceByProductId]
  );

  const selectedItemsCount = computeSelectedItemsCount({
    catalogProducts,
    qtyByProductId,
    isEditMode
  });

  const selectedTotalQty = useMemo(
    () =>
      computeSelectedTotalQty({
        catalogProducts,
        qtyByProductId,
        stockRows: stockQ.data
      }),
    [catalogProducts, qtyByProductId, stockQ.data]
  );

  const estimatedSum = useMemo(
    () =>
      computeEstimatedSum({
        catalogProducts,
        qtyByProductId,
        stockRows: stockQ.data,
        priceType,
        oldPriceByProductId
      }),
    [catalogProducts, qtyByProductId, stockQ.data, priceType, oldPriceByProductId]
  );

  const totalVolumeM3 = useMemo(
    () =>
      computeTotalVolumeM3({
        catalogProducts,
        qtyByProductId,
        stockRows: stockQ.data
      }),
    [catalogProducts, qtyByProductId, stockQ.data]
  );

  const stockByProduct = new Map<number, { qty: string; reserved_qty: string }>(
    (stockQ.data ?? []).map((s) => [s.product_id, s])
  );

  return {
    categoryFilterSet,
    categoryFilterActive,
    catalogProducts,
    categoryIdsWithPositiveStock,
    categoriesWithWarehouseSellableStock,
    lineProblemCountByCategoryId,
    productSearchNorm,
    displayProducts,
    displayProductGroups,
    catalogTabMode,
    tableProductGroups,
    hasQtyOverStock,
    hasMissingPriceForSelected,
    missingPriceProductNames,
    selectedItemsCount,
    selectedTotalQty,
    estimatedSum,
    totalVolumeM3,
    stockByProduct
  };
}
