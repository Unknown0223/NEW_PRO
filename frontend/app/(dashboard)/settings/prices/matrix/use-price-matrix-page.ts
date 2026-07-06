"use client";

import { downloadPriceMatrixTemplate } from "@/components/settings/prices/price-matrix-template";
import {
  flattenCategories,
  type PriceMatrixCategory,
  type PriceMatrixRow
} from "@/components/settings/prices/price-matrix-types";
import type { CategoryPanelMeta } from "@/components/settings/prices/price-matrix-category-panels";
import { api } from "@/lib/api";
import {
  firstMessagePerField,
  firstValidationUserHint,
  getZodFlattenFromApiErrorBody
} from "@/lib/api-validation-details";
import { getUserFacingError, withApiSupportLine } from "@/lib/error-utils";
import { countMatrixDraftChanges } from "@/lib/price-matrix-changes";
import {
  draftItemsFromMatrix,
  formatPriceDraftDisplay,
  parsePriceDraft
} from "@/lib/price-matrix-draft";
import { applyPercentToDraft } from "@/lib/price-matrix-percent";
import {
  buildSkuIndex,
  parsePriceMatrixXlsxRows,
  readXlsxMatrix,
  type PriceMatrixImportPreviewRow
} from "@/lib/price-matrix-import-parse";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

export function usePriceMatrixPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const role = useEffectiveRole();
  const isAdmin = isAdminOrOperatorLikeRole(role);
  const qc = useQueryClient();

  const [kind, setKind] = useState<"sale" | "purchase">("sale");
  const [priceType, setPriceType] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const [effectiveAt, setEffectiveAt] = useState(() => new Date());
  const [bulk, setBulk] = useState("");
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [serverFieldErrs, setServerFieldErrs] = useState<Record<string, string>>({});
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<PriceMatrixImportPreviewRow[]>([]);
  const [importParseErr, setImportParseErr] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  const categoryIdsArr = useMemo(
    () => [...selectedCategoryIds].sort((a, b) => a - b),
    [selectedCategoryIds]
  );

  const categoriesQ = useQuery({
    queryKey: ["product-categories", tenantSlug],
    enabled: Boolean(tenantSlug) && isAdmin,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: PriceMatrixCategory[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data;
    }
  });

  const flatCats = useMemo(() => flattenCategories(categoriesQ.data ?? []), [categoriesQ.data]);

  const priceTypesQ = useQuery({
    queryKey: ["price-types", tenantSlug, kind],
    enabled: Boolean(tenantSlug) && isAdmin,
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types?kind=${kind}`);
      return data.data;
    }
  });

  const matrixQ = useQuery({
    queryKey: ["price-matrix", tenantSlug, categoryIdsArr.join(","), priceType],
    enabled:
      Boolean(tenantSlug) && isAdmin && categoryIdsArr.length > 0 && priceType.length > 0,
    staleTime: STALE.detail,
    queryFn: async () => {
      const qs = new URLSearchParams({
        category_ids: categoryIdsArr.join(","),
        price_type: priceType
      });
      const { data } = await api.get<{ data: PriceMatrixRow[]; currency: string }>(
        `/api/${tenantSlug}/products/prices/matrix?${qs}`
      );
      return data;
    }
  });

  const matrixRows = useMemo(() => matrixQ.data?.data ?? [], [matrixQ.data?.data]);
  const currency = matrixQ.data?.currency ?? "UZS";
  const categoryIdsKey = categoryIdsArr.join(",");

  const selectedCategoryLabels = useMemo(() => {
    const labelById = new Map(flatCats.map((c) => [c.id, c.label]));
    return categoryIdsArr.map((id) => labelById.get(id) ?? `Категория #${id}`);
  }, [categoryIdsArr, flatCats]);

  const categoryPanels = useMemo((): CategoryPanelMeta[] => {
    const labelById = new Map(flatCats.map((c) => [c.id, c.label]));
    const byCat = new Map<number, PriceMatrixRow[]>();
    for (const r of matrixRows) {
      const cid = r.category_id ?? 0;
      if (!cid) continue;
      const arr = byCat.get(cid) ?? [];
      arr.push(r);
      byCat.set(cid, arr);
    }
    const out: CategoryPanelMeta[] = [];
    for (const id of categoryIdsArr) {
      const rows = byCat.get(id) ?? [];
      out.push({
        id,
        label: labelById.get(id) ?? `Категория #${id}`,
        rows
      });
    }
    return out;
  }, [matrixRows, categoryIdsArr, flatCats]);

  const syncDraftFromRows = useCallback((rows: PriceMatrixRow[]) => {
    const next: Record<number, string> = {};
    for (const r of rows) {
      const raw = r.price ?? "";
      const parsed = parsePriceDraft(String(raw));
      next[r.product_id] = parsed.ok ? formatPriceDraftDisplay(parsed.value) : raw;
    }
    setDraft(next);
  }, []);

  useEffect(() => {
    syncDraftFromRows(matrixQ.data?.data ?? []);
  }, [matrixQ.data?.data, categoryIdsKey, priceType, syncDraftFromRows]);

  useEffect(() => {
    setPriceType("");
  }, [kind]);

  useEffect(() => {
    const list = priceTypesQ.data ?? [];
    if (priceType && list.length > 0 && !list.includes(priceType)) {
      setPriceType("");
    }
  }, [priceTypesQ.data, priceType]);

  const changeCount = useMemo(
    () => countMatrixDraftChanges(matrixRows, draft),
    [matrixRows, draft]
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!tenantSlug || categoryIdsArr.length === 0 || !priceType) throw new Error("bad");
      const items = draftItemsFromMatrix(matrixRows, draft);
      if (items.length === 0) throw new Error("EMPTY");
      const { data } = await api.patch<{
        ok: boolean;
        mode?: string;
        effective_at?: string;
      }>(`/api/${tenantSlug}/products/prices/matrix`, {
        price_type: priceType,
        currency,
        category_ids: categoryIdsArr,
        effective_at: effectiveAt.toISOString(),
        items
      });
      return data;
    },
    onMutate: () => {
      setServerFieldErrs({});
      setMsg(null);
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["price-matrix", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["finance-price-overview", tenantSlug] });
      setServerFieldErrs({});
      setSaveDialogOpen(false);
      if (data.mode === "scheduled" && data.effective_at) {
        const when = new Date(data.effective_at).toLocaleString("ru-RU");
        setMsg(`Rejalashtirildi: narxlar ${when} da qo‘llanadi.`);
      } else {
        setMsg("Saqlandi.");
      }
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === "EMPTY") {
        setServerFieldErrs({});
        setMsg("Kamida bitta narx kiriting.");
        return;
      }
      if (isAxiosError(e)) {
        const flat = getZodFlattenFromApiErrorBody(e.response?.data);
        if (flat) {
          const per = firstMessagePerField(flat);
          setServerFieldErrs(per);
          const top = flat.formErrors.map((s) => s.trim()).find(Boolean);
          const hint = firstValidationUserHint(flat);
          const line = top ?? hint ?? Object.values(per).find((m) => m.trim() !== "");
          setMsg(line ? withApiSupportLine(line, e) : getUserFacingError(e, "Saqlashda xato."));
          return;
        }
        setServerFieldErrs({});
      } else {
        setServerFieldErrs({});
      }
      setMsg(getUserFacingError(e, "Saqlashda xato."));
    }
  });

  function applyBulk() {
    const n = Number.parseFloat(String(bulk).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const formatted = formatPriceDraftDisplay(n);
    const next = { ...draft };
    for (const r of matrixRows) {
      next[r.product_id] = formatted;
    }
    setDraft(next);
  }

  function applyPercent(factor: number) {
    setDraft((prev) => applyPercentToDraft(matrixRows, prev, factor));
  }

  function resetDraft() {
    syncDraftFromRows(matrixRows);
  }

  async function handleDownloadTemplate() {
    setImportParseErr(null);
    if (!priceType) {
      setImportParseErr("Avval narx turini tanlang.");
      return;
    }
    if (categoryIdsArr.length === 0) {
      setImportParseErr("Avval kamida bitta kategoriya belgilang.");
      return;
    }
    if (matrixRows.length === 0) {
      setImportParseErr("Tanlangan kategoriyalarda mahsulot yo‘q.");
      return;
    }
    setTemplateLoading(true);
    try {
      await downloadPriceMatrixTemplate(matrixRows, {
        priceType,
        categoryLabels: selectedCategoryLabels,
        draft,
        currency
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "PRICE_TYPE_REQUIRED") {
        setImportParseErr("Narx turini tanlang.");
        return;
      }
      setImportParseErr(getUserFacingError(e, "Shablon yuklab olishda xato."));
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleImportFile(file: File) {
    setImportParseErr(null);
    if (!priceType) {
      setImportParseErr("Narx turini tanlang.");
      return;
    }
    if (categoryIdsArr.length === 0) {
      setImportParseErr("Avval kamida bitta kategoriya belgilang.");
      return;
    }
    if (matrixRows.length === 0) {
      setImportParseErr("Tanlangan kategoriyalarda mahsulot yo‘q.");
      return;
    }
    try {
      const matrix = await readXlsxMatrix(file);
      const skuIndex = buildSkuIndex(matrixRows);
      const parsed = parsePriceMatrixXlsxRows(matrix, skuIndex);
      if (parsed.length === 0) {
        setImportParseErr("Faylda import qilinadigan qator yo‘q.");
        return;
      }
      setImportRows(parsed);
      setImportOpen(true);
    } catch (e: unknown) {
      setImportParseErr(getUserFacingError(e, "Excel o‘qishda xato."));
    }
  }

  async function handleImportSaved() {
    await qc.invalidateQueries({ queryKey: ["price-matrix", tenantSlug] });
    await qc.invalidateQueries({ queryKey: ["finance-price-overview", tenantSlug] });
    setMsg("Excel import saqlandi.");
  }

  const hasCategories = categoryIdsArr.length > 0;
  const toolbarEnabled = hasCategories && matrixRows.length > 0;

  return {
    tenantSlug,
    hydrated,
    isAdmin,
    kind,
    setKind,
    priceType,
    setPriceType,
    selectedCategoryIds,
    setSelectedCategoryIds,
    effectiveAt,
    setEffectiveAt,
    bulk,
    setBulk,
    draft,
    setDraft,
    msg,
    serverFieldErrs,
    templateLoading,
    importOpen,
    setImportOpen,
    importRows,
    importParseErr,
    saveDialogOpen,
    setSaveDialogOpen,
    categoryIdsArr,
    flatCats,
    priceTypes: priceTypesQ.data ?? [],
    categoryPanels,
    currency,
    matrixRows,
    matrixLoading: matrixQ.isLoading,
    changeCount,
    saveMut,
    applyBulk,
    applyPercent,
    resetDraft,
    handleDownloadTemplate,
    handleImportFile,
    handleImportSaved,
    hasCategories,
    toolbarEnabled
  };
}
