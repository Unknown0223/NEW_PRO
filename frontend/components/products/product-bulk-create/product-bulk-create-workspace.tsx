"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { ProductBulkCreateGrid } from "./product-bulk-create-grid";
import {
  applyBulkPatch,
  buildBulkItems,
  createBulkRow,
  createInitialBulkRows,
  emptyBulkMasterData,
  initialBulkApply,
  itemsZodRowMessages,
  validateBulkRows,
  type BulkApplyState,
  type BulkProductMasterData,
  type BulkProductRow,
  type RefOption
} from "./product-bulk-create-types";

type Props = {
  tenantSlug: string | null;
  backHref: string;
  onDone?: () => void;
};

type CatRow = { id: number; name: string; code: string | null };

function catalogQuery(tenantSlug: string, path: string, key: string) {
  return {
    queryKey: ["product-bulk-master", path, tenantSlug, key],
    staleTime: STALE.reference,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "500", is_active: "true" });
      const { data } = await api.get<{ data: RefOption[] }>(
        `/api/${tenantSlug}/${path}?${params}`
      );
      return data.data ?? [];
    }
  };
}

export function ProductBulkCreateWorkspace({ tenantSlug, backHref, onDone }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<BulkProductRow[]>(() => createInitialBulkRows(3));
  const [selected, setSelected] = useState<boolean[]>(() => [false, false, false]);
  const [bulkApply, setBulkApply] = useState<BulkApplyState>(initialBulkApply);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const catsQ = useQuery({
    queryKey: ["product-categories", tenantSlug, "bulk-create"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CatRow[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data;
    }
  });

  const groupsQ = useQuery({
    ...catalogQuery(tenantSlug ?? "", "catalog/product-groups", "groups"),
    enabled: Boolean(tenantSlug)
  });
  const brandsQ = useQuery({
    ...catalogQuery(tenantSlug ?? "", "catalog/brands", "brands"),
    enabled: Boolean(tenantSlug)
  });
  const tradeDirsQ = useQuery({
    queryKey: ["trade-directions", tenantSlug, "bulk-create"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: RefOption[] }>(
        `/api/${tenantSlug}/trade-directions?is_active=true`
      );
      return data.data ?? [];
    }
  });

  const masterData: BulkProductMasterData = useMemo(
    () => ({
      categories: (catsQ.data ?? []).map((c) => ({ id: c.id, name: c.name, code: c.code })),
      groups: groupsQ.data ?? [],
      brands: brandsQ.data ?? [],
      tradeDirections: tradeDirsQ.data ?? []
    }),
    [catsQ.data, groupsQ.data, brandsQ.data, tradeDirsQ.data]
  );

  const loadingMasterData =
    catsQ.isLoading || groupsQ.isLoading || brandsQ.isLoading || tradeDirsQ.isLoading;
  const masterLoadFailed =
    catsQ.isError || groupsQ.isError || brandsQ.isError || tradeDirsQ.isError;

  function syncSelection(nextRows: BulkProductRow[], prevSelected: boolean[]) {
    if (prevSelected.length === nextRows.length) return prevSelected;
    if (prevSelected.length < nextRows.length) {
      return [...prevSelected, ...Array(nextRows.length - prevSelected.length).fill(false)];
    }
    return prevSelected.slice(0, nextRows.length);
  }

  function updateRow(id: string, patch: Partial<BulkProductRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setRowErrors({});
  }

  function addRow() {
    setRows((current) => {
      const next = [...current, createBulkRow(current.length)];
      setSelected((prev) => syncSelection(next, prev));
      return next;
    });
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length === 1) return current;
      const index = current.findIndex((row) => row.id === id);
      const next = current.filter((row) => row.id !== id);
      setSelected((prev) => {
        const copy = [...prev];
        copy.splice(index, 1);
        return copy;
      });
      return next;
    });
    setRowErrors({});
  }

  function toggleAll(checked: boolean) {
    setSelected(rows.map(() => checked));
  }

  function toggleRow(index: number, checked: boolean) {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = checked;
      return next;
    });
  }

  function applyRowsPatch(rowsPatch: Partial<BulkProductRow>) {
    setRows((current) => applyBulkPatch(current, selected, rowsPatch));
    setRowErrors({});
    setMessage(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug) throw new Error("Tenant topilmadi");
      const items = buildBulkItems(rows);
      if (items.length === 0) throw new Error("Заполните хотя бы одну строку");
      const { data } = await api.post<{ created: number; errors: string[] }>(
        `/api/${tenantSlug}/products/bulk`,
        { items }
      );
      return data;
    },
    onSuccess: async (result) => {
      const extra =
        result.errors.length > 0 ? ` Предупреждения: ${result.errors.slice(0, 3).join("; ")}` : "";
      setMessage({ type: "success", text: `Сохранено товаров: ${result.created}.${extra}` });
      setRowErrors({});
      setRows(createInitialBulkRows(3));
      setSelected([false, false, false]);
      setBulkApply(initialBulkApply);
      await qc.invalidateQueries({ queryKey: ["products", tenantSlug] });
      onDone?.();
    },
    onError: (error: unknown) => {
      if (isAxiosError(error)) {
        const flat = getZodFlattenFromApiErrorBody(error.response?.data);
        if (flat) {
          setRowErrors(itemsZodRowMessages(firstMessagePerField(flat)));
          const hint = firstValidationUserHint(flat);
          setMessage({
            type: "error",
            text: hint
              ? withApiSupportLine(`Проверка: ${hint}`, error)
              : withApiSupportLine(getUserFacingError(error, "Ошибка сохранения"), error)
          });
          return;
        }
      }
      setRowErrors({});
      setMessage({
        type: "error",
        text: getUserFacingError(error, "Не удалось сохранить товары")
      });
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const errors = validateBulkRows(rows);
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setMessage({ type: "error", text: "Исправьте ошибки в отмеченных строках." });
      return;
    }
    if (buildBulkItems(rows).length === 0) {
      setMessage({ type: "error", text: "Заполните хотя бы одну строку." });
      return;
    }
    saveMut.mutate();
  }

  if (!tenantSlug) {
    return <p className="text-sm text-destructive">Сессия не найдена. Войдите снова.</p>;
  }

  return (
    <ProductBulkCreateGrid
      backHref={backHref}
      masterData={masterLoadFailed ? emptyBulkMasterData : masterData}
      loadingMasterData={loadingMasterData}
      rows={rows}
      selected={selected}
      bulkApply={bulkApply}
      rowErrors={rowErrors}
      saving={saveMut.isPending}
      message={
        masterLoadFailed && !message
          ? { type: "error", text: "Справочники не загрузились. Проверьте подключение." }
          : message
      }
      onBulkApplyChange={setBulkApply}
      onApplyCategory={() => applyRowsPatch({ categoryId: bulkApply.categoryId })}
      onApplyUnit={() =>
        applyRowsPatch({ unit: bulkApply.unit, unitCustom: bulkApply.unitCustom })
      }
      onApplyGroup={() => applyRowsPatch({ groupId: bulkApply.groupId })}
      onApplyBrand={() => applyRowsPatch({ brandId: bulkApply.brandId })}
      onApplyTradeDirections={() =>
        applyRowsPatch({ tradeDirectionIds: [...bulkApply.tradeDirectionIds] })
      }
      onToggleAll={toggleAll}
      onToggleRow={toggleRow}
      onUpdateRow={updateRow}
      onAddRow={addRow}
      onRemoveRow={removeRow}
      onSubmit={handleSubmit}
    />
  );
}
