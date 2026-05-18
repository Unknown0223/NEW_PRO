"use client";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import type { ProductRow } from "@/lib/product-types";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { downloadXlsxSheet } from "@/lib/download-xlsx";
import { QueryErrorState } from "@/components/common/query-error-state";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { TableColumnSettingsDialog } from "@/components/data-table/table-column-settings-dialog";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { useUserTablePrefs } from "@/hooks/use-user-table-prefs";
import {
  PRODUCT_ITEMS_COLUMNS,
  PRODUCT_ITEMS_COLUMN_IDS,
  PRODUCT_ITEMS_TABLE_ID,
  productItemsExportCell
} from "@/lib/products-catalog-columns";
import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";
import { STALE } from "@/lib/query-stale";
import { Ban, ListOrdered, Pencil, RefreshCw, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { CatalogInterchangeableTab } from "./catalog-interchangeable-tab";
import { CatalogSimpleTab } from "./catalog-simple-tab";
import { ProductQuickAddDialog } from "./product-quick-add-dialog";
import { ProductForm } from "./product-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const TABS = [
  { id: "items", label: "Товар" },
  { id: "equipment-items", label: "Оборудование товары" },
  { id: "product-groups", label: "Группа товаров" },
  { id: "interchangeable", label: "Группа взаимозаменяемых" },
  { id: "brands", label: "Бренд" },
  { id: "manufacturers", label: "Производитель" },
  { id: "segments", label: "Сегменты" }
] as const;

type TabId = (typeof TABS)[number]["id"];

function isTabId(v: string | null): v is TabId {
  return TABS.some((t) => t.id === v);
}

function retailPriceLabel(row: ProductRow): string {
  const p = row.prices?.find((x) => x.price_type === "retail");
  return p != null ? p.price : "—";
}

type ItemsProps = {
  tenantSlug: string | null;
  isAdmin: boolean;
  statusTab: "active" | "inactive";
  search: string;
};

function EquipmentItemsTab({
  tenantSlug,
  isAdmin,
  statusTab,
  search
}: {
  tenantSlug: string | null;
  isAdmin: boolean;
  statusTab: "active" | "inactive";
  search: string;
}) {
  const qc = useQueryClient();
  const [savingId, setSavingId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickedIds, setPickedIds] = useState<Set<number>>(new Set());
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ProductRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const isActiveFilter = statusTab === "active" ? "true" : "false";

  const listQ = useQuery({
    queryKey: ["products", tenantSlug, "equipment-mark-tab", statusTab, search],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "1000",
        is_active: isActiveFilter,
        is_equipment: "true"
      });
      if (search.trim()) params.set("search", search.trim());
      const { data } = await api.get<{ data: ProductRow[] }>(`/api/${tenantSlug}/products?${params}`);
      return data.data ?? [];
    }
  });

  const pickQ = useQuery({
    queryKey: ["products", tenantSlug, "equipment-picker", statusTab, pickerSearch],
    enabled: Boolean(tenantSlug) && addOpen,
    staleTime: STALE.list,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "1000"
      });
      if (pickerSearch.trim()) params.set("search", pickerSearch.trim());
      const { data } = await api.get<{ data: ProductRow[] }>(`/api/${tenantSlug}/products?${params}`);
      return (data.data ?? []).filter((r) => r.is_equipment !== true);
    }
  });

  async function toggleActive(row: ProductRow, next: boolean) {
    if (!tenantSlug) return;
    try {
      setSavingId(row.id);
      await api.put(`/api/${tenantSlug}/products/${row.id}`, { is_active: next });
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      setMsg(null);
    } finally {
      setSavingId(null);
    }
  }

  const rows = listQ.data ?? [];
  const pickRows = pickQ.data ?? [];
  const selectedPickCount = pickedIds.size;

  function exportEquipmentItemsExcel() {
    const headers = ["Товар", "SKU", "Категория", "Статус"];
    const dataRows = rows.map((r) => [
      r.name ?? "",
      r.sku ?? "",
      r.category?.name ?? "",
      r.is_active ? "Активный" : "Не активный"
    ]);
    downloadXlsxSheet(
      `equipment_products_${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Оборудование товары",
      headers,
      dataRows
    );
  }

  function openEdit(r: ProductRow) {
    setEditRow(r);
    setEditName(r.name);
    setEditSku(r.sku);
    setEditActive(r.is_active);
    setEditOpen(true);
    setMsg(null);
  }

  async function saveEdit() {
    if (!tenantSlug || !editRow) return;
    const name = editName.trim();
    const sku = editSku.trim();
    if (!name || !sku) {
      setMsg("Название ва SKU majburiy.");
      return;
    }
    try {
      setSavingId(editRow.id);
      await api.put(`/api/${tenantSlug}/products/${editRow.id}`, {
        name,
        sku,
        is_active: editActive
      });
      setEditOpen(false);
      setEditRow(null);
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      setMsg(null);
    } finally {
      setSavingId(null);
    }
  }

  async function addPickedEquipment() {
    if (!tenantSlug) return;
    const ids = Array.from(pickedIds).filter((x) => Number.isFinite(x) && x > 0);
    if (ids.length === 0) {
      setMsg("Камида битта маҳсулотни танланг.");
      return;
    }
    try {
      setSavingId(-1);
      await Promise.all(ids.map((id) => api.put(`/api/${tenantSlug}/products/${id}`, { is_equipment: true })));
      setAddOpen(false);
      setPickedIds(new Set());
      setPickerSearch("");
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      setMsg(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Бу жадвалда фақат `Оборудование` учун белгиланган товарлар кўринади. `Добавить` орқали актив ва неактив
        маҳсулотлардан танлаб қўшасиз; `Тahrirlash` билан номи/SKU ва активлиги ўзгаради.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Статус: <span className="font-medium">{statusTab === "active" ? "Активный" : "Не активный"}</span> •
          Показано: {formatGroupedInteger(rows.length)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={exportEquipmentItemsExcel}
            disabled={rows.length === 0}
          >
            Excel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setPickedIds(new Set());
              setPickerSearch("");
              setAddOpen(true);
            }}
          >
            Добавить
          </Button>
        </div>
      </div>
      <div className="-mx-3 overflow-x-auto border-t border-border/80 sm:-mx-4">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="app-table-thead text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Товар</th>
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Категория</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {listQ.isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Пусто
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.category?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.is_active ? "Активный" : "Не активный"}</td>
                  <td className="px-3 py-2">
                    <TableRowActionGroup className="justify-end" ariaLabel="Оборудование товар">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground"
                        title="Tahrirlash"
                        aria-label="Tahrirlash"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      {r.is_active ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={savingId === r.id}
                          onClick={() => void toggleActive(r, false)}
                        >
                          Неактив қилиш
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={savingId === r.id}
                          onClick={() => void toggleActive(r, true)}
                        >
                          Фаоллаштириш
                        </Button>
                      )}
                    </TableRowActionGroup>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[700px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Оборудование товарыга қўшиш</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Бир вақтда бир нечта маҳсулот танланади. Танланганлар:{" "}
              <span className="font-semibold text-foreground">{formatGroupedInteger(selectedPickCount)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 min-w-[220px] flex-1"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Маҳсулот қидириш (ном/SKU)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setPickedIds(new Set(pickRows.map((r) => r.id)))}
                disabled={pickRows.length === 0}
              >
                Ҳаммасини белгилаш
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setPickedIds(new Set())}
                disabled={selectedPickCount === 0}
              >
                Белгини олиш
              </Button>
            </div>
            <div className="max-h-[360px] overflow-auto rounded-md border border-border/80 bg-background">
              {pickQ.isLoading ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Загрузка…</div>
              ) : pickRows.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">Қидирув бўйича маҳсулот топилмади.</div>
              ) : (
                <div className="divide-y">
                  {pickRows.map((r) => {
                    const checked = pickedIds.has(r.id);
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={checked}
                          onChange={(e) => {
                            setPickedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(r.id);
                              else next.delete(r.id);
                              return next;
                            });
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: <span className="font-mono">{r.sku}</span>
                            {r.category?.name ? ` • ${r.category.name}` : ""}
                            {` • ${r.is_active ? "Активный" : "Не активный"}`}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Отмена
              </Button>
              <Button
                disabled={savingId != null || selectedPickCount === 0}
                onClick={() => void addPickedEquipment()}
              >
                Қўшиш ({formatGroupedInteger(selectedPickCount)})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]" showCloseButton>
          <DialogHeader>
            <DialogTitle>Оборудование товар — tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Название" />
            <Input value={editSku} onChange={(e) => setEditSku(e.target.value)} placeholder="SKU" />
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>Активный</span>
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
              <Button disabled={savingId != null} onClick={() => void saveEdit()}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemsTab({ tenantSlug, isAdmin, statusTab, search }: ItemsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const productsBasePath = pathname.startsWith("/settings/products")
    ? "/settings/products"
    : "/products";
  const qc = useQueryClient();
  const priceFileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [productGroupId, setProductGroupId] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [fullProductOpen, setFullProductOpen] = useState(false);
  const [fullProductId, setFullProductId] = useState<number | null>(null);
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);

  const tablePrefs = useUserTablePrefs({
    tenantSlug,
    tableId: PRODUCT_ITEMS_TABLE_ID,
    defaultColumnOrder: [...PRODUCT_ITEMS_COLUMN_IDS],
    defaultPageSize: 10,
    allowedPageSizes: [10, 15, 20, 30, 50, 100]
  });
  const pageSize = tablePrefs.pageSize;

  const isActiveFilter = statusTab === "active" ? "true" : "false";

  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "items-tab"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data;
    }
  });

  const groupsQ = useQuery({
    queryKey: ["catalog-simple", "catalog/product-groups", tenantSlug, "items-filter"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "500", is_active: "true" });
      const { data } = await api.get<{ data: { id: number; name: string }[] }>(
        `/api/${tenantSlug}/catalog/product-groups?${params}`
      );
      return data.data;
    }
  });

  const listQ = useQuery({
    queryKey: [
      "products",
      tenantSlug,
      "workspace",
      search,
      page,
      pageSize,
      categoryId,
      productGroupId,
      isActiveFilter
    ],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        include_prices: "true",
        is_active: isActiveFilter
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryId) params.set("category_id", categoryId);
      if (productGroupId) params.set("product_group_id", productGroupId);
      const { data } = await api.get<{
        data: ProductRow[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/${tenantSlug}/products?${params}`);
      return data;
    }
  });

  useEffect(() => {
    setPage(1);
  }, [search, statusTab, pageSize, categoryId, productGroupId]);

  /** API `DELETE` mahsulotni bazadan olib tashlamaydi — faqat neaktiv qiladi. */
  const deactivateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/products/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
    }
  });

  const activateMut = useMutation({
    mutationFn: async (id: number) => {
      await api.put(`/api/${tenantSlug}/products/${id}`, { is_active: true });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
    }
  });

  const priceImportMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      const { data: body } = await api.post<{ upserted: number; errors: string[] }>(
        `/api/${tenantSlug}/products/prices/import`,
        fd
      );
      return body;
    },
    onSuccess: async (res) => {
      setImportMsg(`Narxlar: ${res.upserted}`);
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      if (priceFileRef.current) priceFileRef.current.value = "";
    },
    onError: (e: unknown) => setImportMsg(getUserFacingError(e, "Narx import xatosi."))
  });

  const rows = listQ.data?.data ?? [];
  const total = listQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function renderProductCell(colId: string, r: ProductRow): ReactNode {
    switch (colId) {
      case "name":
        return r.name;
      case "category":
        return <span className="text-xs text-muted-foreground">{r.category?.name ?? "—"}</span>;
      case "product_group":
        return <span className="text-xs text-muted-foreground">{r.product_group?.name ?? "—"}</span>;
      case "unit":
        return <span className="text-xs">{r.unit}</span>;
      case "qty_per_block":
        return r.qty_per_block != null ? (
          <span className="tabular-nums text-xs">
            {formatNumberGrouped(r.qty_per_block, { maxFractionDigits: 3 })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "sort_order":
        return (
          <span className="text-xs">
            {r.sort_order != null ? formatGroupedInteger(r.sort_order) : "—"}
          </span>
        );
      case "brand":
        return <span className="text-xs text-muted-foreground">{r.brand?.name ?? "—"}</span>;
      case "segment":
        return <span className="text-xs text-muted-foreground">{r.segment?.name ?? "—"}</span>;
      case "sku":
        return <span className="font-mono text-xs">{r.sku}</span>;
      case "ikpu_code":
        return <span className="font-mono text-xs">{r.ikpu_code ?? "—"}</span>;
      case "hs_code":
        return <span className="font-mono text-xs">{r.hs_code ?? "—"}</span>;
      case "price": {
        const pl = retailPriceLabel(r);
        return (
          <span className="font-mono text-xs">
            {pl === "—" ? pl : formatNumberGrouped(pl, { maxFractionDigits: 2 })}
          </span>
        );
      }
      default:
        return "—";
    }
  }

  function exportExcel() {
    const order = tablePrefs.visibleColumnOrder;
    const headers = order.map((id) => PRODUCT_ITEMS_COLUMNS.find((c) => c.id === id)?.label ?? id);
    const dataRows = rows.map((r) => order.map((colId) => productItemsExportCell(r, colId)));
    downloadXlsxSheet(
      `products_${new Date().toISOString().slice(0, 10)}.xlsx`,
      "Товары",
      headers,
      dataRows
    );
  }

  const inputCls =
    "flex h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid shrink-0 gap-1 text-xs text-muted-foreground">
          <span className="leading-none">Sahifa</span>
          <select
            className={`${inputCls} h-9 min-w-[4rem]`}
            value={pageSize}
            onChange={(e) => {
              tablePrefs.setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 15, 20, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="grid shrink-0 gap-1 text-xs text-muted-foreground">
          <span className="leading-none">Категория</span>
          <select
            className={`${inputCls} min-w-[9rem]`}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Все</option>
            {(categoriesQ.data ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid shrink-0 gap-1 text-xs text-muted-foreground">
          <span className="leading-none">Группа товаров</span>
          <select
            className={`${inputCls} min-w-[9rem]`}
            value={productGroupId}
            onChange={(e) => setProductGroupId(e.target.value)}
          >
            <option value="">Все</option>
            {(groupsQ.data ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {isAdmin ? (
          <>
            <div className="relative shrink-0">
              <div className="flex">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-r-none px-3"
                  onClick={() => {
                    setFullProductId(null);
                    setFullProductOpen(true);
                    setAddMenuOpen(false);
                  }}
                >
                  Добавить
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-l-none border-l border-primary-foreground/30 px-2"
                  onClick={() => setAddMenuOpen((o) => !o)}
                  aria-expanded={addMenuOpen}
                  aria-label="Добавить меню"
                >
                  ▾
                </Button>
              </div>
                {addMenuOpen ? (
                  <div
                    className="absolute right-0 z-50 mt-1 min-w-[240px] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setFullProductId(null);
                        setFullProductOpen(true);
                        setAddMenuOpen(false);
                      }}
                    >
                      Полная форма
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setQuickAddOpen(true);
                        setAddMenuOpen(false);
                      }}
                    >
                      Быстрое добавление
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setAddMenuOpen(false);
                        router.push(`${productsBasePath}/bulk`);
                      }}
                    >
                      Bir nechta qo‘shish
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setAddMenuOpen(false);
                        router.push(`${productsBasePath}/excel`);
                      }}
                    >
                      Exceldan import
                    </button>
                  </div>
                ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => priceFileRef.current?.click()}
              disabled={priceImportMut.isPending}
            >
              Narx import
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1"
          onClick={() => setColumnDialogOpen(true)}
        >
          <ListOrdered className="h-4 w-4" />
          Ustunlar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 gap-1"
          onClick={() => void listQ.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
          Yangilash
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          onClick={exportExcel}
          disabled={rows.length === 0}
        >
          Excel
        </Button>
        <input
          ref={priceFileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) priceImportMut.mutate(f);
          }}
        />
      </div>

      {importMsg ? <p className="text-xs text-muted-foreground">{importMsg}</p> : null}

      <TableColumnSettingsDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        title="Ustunlarni boshqarish"
        description="Ko‘rinadigan ustunlar va tartib. Sizning akkauntingiz uchun saqlanadi (server)."
        columns={PRODUCT_ITEMS_COLUMNS}
        columnOrder={tablePrefs.columnOrder}
        hiddenColumnIds={tablePrefs.hiddenColumnIds}
        saving={tablePrefs.saving}
        onSave={(next) => tablePrefs.saveColumnLayout(next)}
        onReset={() => tablePrefs.resetColumnLayout()}
      />

      <p className="text-xs text-muted-foreground">
        <Link href="/settings/product-categories" className="text-primary underline-offset-4 hover:underline">
          Категория продукта
        </Link>{" "}
        — иерархия; здесь «группа товаров» — отдельный справочник (вкладка).
      </p>

      {listQ.isError ? (
        <QueryErrorState
          message={getUserFacingError(listQ.error, "Mahsulotlar yuklanmadi.")}
          onRetry={() => void listQ.refetch()}
        />
      ) : (
        <div className="-mx-3 overflow-x-auto border-t border-border/80 sm:-mx-4">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="app-table-thead text-left">
              <tr>
                {tablePrefs.visibleColumnOrder.map((colId) => {
                  const label = PRODUCT_ITEMS_COLUMNS.find((c) => c.id === colId)?.label ?? colId;
                  return (
                    <th
                      key={colId}
                      className={cn("px-2 py-2 font-medium", colId === "price" && "text-right")}
                    >
                      {label}
                    </th>
                  );
                })}
                <th className="px-2 py-2 text-right font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {listQ.isLoading ? (
                <tr>
                  <td
                    colSpan={tablePrefs.visibleColumnOrder.length + 1}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    Загрузка…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tablePrefs.visibleColumnOrder.length + 1}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    Пусто
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    {tablePrefs.visibleColumnOrder.map((colId) => (
                      <td
                        key={colId}
                        className={cn(
                          "px-2 py-1.5",
                          colId === "price" && "text-right"
                        )}
                      >
                        {renderProductCell(colId, r)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right">
                      {isAdmin ? (
                        <TableRowActionGroup className="justify-end" ariaLabel="Mahsulot">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className="text-muted-foreground hover:text-foreground"
                            title="Tahrirlash"
                            aria-label="Tahrirlash"
                            onClick={() => {
                              setFullProductId(r.id);
                              setFullProductOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" aria-hidden />
                          </Button>
                          {statusTab === "active" ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="text-amber-800 hover:bg-amber-500/15 hover:text-amber-900 dark:text-amber-200 dark:hover:bg-amber-500/20"
                              disabled={deactivateMut.isPending}
                              title="Neaktiv qilish"
                              aria-label="Neaktiv qilish"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `«${r.name}» neaktiv qilinsinmi? Ma’lumot o‘chirilmaydi — mahsulot «Не активный» ro‘yxatiga o‘tadi.`
                                  )
                                ) {
                                  deactivateMut.mutate(r.id);
                                }
                              }}
                            >
                              <Ban className="size-3.5" aria-hidden />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              className="text-emerald-800 hover:bg-emerald-500/15 hover:text-emerald-900 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                              disabled={activateMut.isPending}
                              title="Faollashtirish"
                              aria-label="Faollashtirish"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `«${r.name}» qayta faol qilinsinmi? U «Активный» ro‘yxatida ko‘rinadi.`
                                  )
                                ) {
                                  activateMut.mutate(r.id);
                                }
                              }}
                            >
                              <RotateCcw className="size-3.5" aria-hidden />
                            </Button>
                          )}
                        </TableRowActionGroup>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total
            ? `Показано ${formatGroupedInteger((page - 1) * pageSize + 1)}–${formatGroupedInteger(Math.min(page * pageSize, total))} / ${formatGroupedInteger(total)}`
            : ""}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ←
          </Button>
          <span className="px-2 py-1">
            {formatGroupedInteger(page)} / {formatGroupedInteger(totalPages)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>

      <ProductQuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        tenantSlug={tenantSlug}
        onDone={() => void qc.invalidateQueries({ queryKey: ["products", tenantSlug] })}
      />

      <Dialog
        open={fullProductOpen}
        onOpenChange={(o) => {
          setFullProductOpen(o);
          if (!o) setFullProductId(null);
        }}
      >
        <DialogContent
          className="max-h-[min(90vh,900px)] w-full max-w-2xl gap-0 overflow-y-auto p-0 sm:max-w-2xl"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>
              {fullProductId != null ? "Редактировать товар" : "Новый товар"}
            </DialogTitle>
          </DialogHeader>
          {tenantSlug ? (
            <ProductForm
              tenantSlug={tenantSlug}
              mode={fullProductId != null ? "edit" : "create"}
              productId={fullProductId}
              layout="modal"
              onSuccess={() => {
                setFullProductOpen(false);
                setFullProductId(null);
                void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
              }}
              onCancel={() => {
                setFullProductOpen(false);
                setFullProductId(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type WorkspaceProps = {
  /** Sozlamalar yon paneli (Категория продукта, …); PageHeader tashqarida bo‘lsa false */
  showSettingsNav?: boolean;
  hideOuterHeader?: boolean;
};

function ProductsCatalogWorkspaceInner({
  showSettingsNav = false,
  hideOuterHeader = false
}: WorkspaceProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const isAdmin = isAdminOrOperatorLikeRole(role);

  const tabRaw = searchParams.get("tab");
  const tab: TabId = isTabId(tabRaw) ? tabRaw : "items";

  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const pageSize = 10;

  function setTab(next: TabId) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", next);
    router.replace(`${pathname}?${p}`, { scroll: false });
  }

  const main = useMemo(() => {
    switch (tab) {
      case "items":
        return (
          <ItemsTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            statusTab={statusTab}
            search={search}
          />
        );
      case "equipment-items":
        return (
          <EquipmentItemsTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            statusTab={statusTab}
            search={search}
          />
        );
      case "product-groups":
        return (
          <CatalogSimpleTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            apiPath="catalog/product-groups"
            title="Справочник групп товаров"
            addLabel="Добавить"
            statusTab={statusTab}
            search={search}
            pageSize={pageSize}
          />
        );
      case "interchangeable":
        return (
          <CatalogInterchangeableTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            statusTab={statusTab}
            search={search}
            pageSize={pageSize}
          />
        );
      case "brands":
        return (
          <CatalogSimpleTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            apiPath="catalog/brands"
            title="Бренды"
            addLabel="Добавить"
            statusTab={statusTab}
            search={search}
            pageSize={pageSize}
          />
        );
      case "manufacturers":
        return (
          <CatalogSimpleTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            apiPath="catalog/manufacturers"
            title="Производители"
            addLabel="Добавить"
            statusTab={statusTab}
            search={search}
            pageSize={pageSize}
          />
        );
      case "segments":
        return (
          <CatalogSimpleTab
            tenantSlug={tenantSlug}
            isAdmin={isAdmin}
            apiPath="catalog/segments"
            title="Сегменты"
            addLabel="Добавить"
            statusTab={statusTab}
            search={search}
            pageSize={pageSize}
          />
        );
      default:
        return null;
    }
  }, [tab, tenantSlug, isAdmin, statusTab, search, pageSize]);

  const headerBlock = hideOuterHeader ? null : (
    <PageHeader
      title="Продукты"
      description="Каталог и справочники. Категории: /settings/product-categories."
      actions={
        <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/dashboard">
          Панель управления
        </Link>
      }
    />
  );

  const shell = (
    <div className="space-y-4">
      {headerBlock}

      <div className="orders-hub-section orders-hub-section--table">
        <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-1 border-b border-border bg-muted/25 px-3 py-2 sm:px-4">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border/80 px-3 py-2 sm:px-4">
              <button
                type="button"
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  statusTab === "active" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
                )}
                onClick={() => setStatusTab("active")}
              >
                Активный
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  statusTab === "inactive" ? "border-b-2 border-primary font-medium" : "text-muted-foreground"
                )}
                onClick={() => setStatusTab("inactive")}
              >
                Не активный
              </button>
            </div>

            <div className="table-toolbar flex flex-wrap items-end gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
              <Input
                className="h-9 max-w-xs bg-background"
                placeholder="Поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => {
                  void qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
                  void qc.invalidateQueries({ queryKey: ["catalog-simple"] });
                  void qc.invalidateQueries({ queryKey: ["catalog-interchangeable", tenantSlug] });
                }}
              >
                Обновить
              </Button>
            </div>

            <div className="px-3 pb-3 pt-2 sm:px-4">
              {!hydrated ? (
                <p className="text-sm text-muted-foreground">Sessiya…</p>
              ) : !tenantSlug ? (
                <p className="text-sm text-destructive">Tenant yo‘q</p>
              ) : (
                main
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (showSettingsNav) {
    return <SettingsWorkspace>{shell}</SettingsWorkspace>;
  }
  return shell;
}

export function ProductsCatalogWorkspace(props: WorkspaceProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
      <ProductsCatalogWorkspaceInner {...props} />
    </Suspense>
  );
}
