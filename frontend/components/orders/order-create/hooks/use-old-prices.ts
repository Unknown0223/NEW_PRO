"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import {
  buildOldPricesAutoComment,
  mergeOldPricesComment
} from "../view/old-prices-modal";

export type PricesAsOfResponse = {
  as_of: string;
  price_type: string;
  items: Array<{
    product_id: number;
    price: string | null;
    currency: string;
    source: "schedule" | "current" | "missing";
  }>;
};

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type UseOldPricesArgs = {
  tenantSlug: string | null;
  productIds: number[];
  priceTypeLabels: Map<string, string>;
  currentPriceType: string;
  orderComment: string;
  setPriceType: (t: string) => void;
  setOrderComment: (value: string) => void;
  setLocalError: (msg: string | null) => void;
};

export function useOldPrices({
  tenantSlug,
  productIds,
  priceTypeLabels,
  currentPriceType,
  orderComment,
  setPriceType,
  setOrderComment,
  setLocalError
}: UseOldPricesArgs) {
  const [oldPricesOpen, setOldPricesOpen] = useState(false);
  const [oldPricesEnabled, setOldPricesEnabled] = useState(false);
  const [priceAsOf, setPriceAsOf] = useState<string | null>(null);
  const [oldPriceByProductId, setOldPriceByProductId] = useState<Record<number, string> | null>(
    null
  );
  const [draftAsOf, setDraftAsOf] = useState(localYmd);
  const [draftPriceType, setDraftPriceType] = useState(currentPriceType || "retail");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const productIdsKey = productIds.join(",");
  const lastFetchedKeyRef = useRef<string | null>(null);

  const clearOldPrices = useCallback(() => {
    setOldPricesEnabled(false);
    setPriceAsOf(null);
    setOldPriceByProductId(null);
    setApplyError(null);
    lastFetchedKeyRef.current = null;
  }, []);

  const openOldPricesModal = useCallback(() => {
    setDraftAsOf(priceAsOf ?? localYmd());
    setDraftPriceType(currentPriceType || "retail");
    setApplyError(null);
    setOldPricesOpen(true);
  }, [priceAsOf, currentPriceType]);

  const fetchAndApply = useCallback(
    async (asOf: string, pt: string, opts?: { silent?: boolean; updateComment?: boolean }) => {
      if (!tenantSlug) {
        if (!opts?.silent) setApplyError("Сессия не готова — обновите страницу.");
        return false;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        if (!opts?.silent) setApplyError("Укажите корректную дату.");
        return false;
      }
      if (productIds.length === 0) {
        if (!opts?.silent) {
          setApplyError("Каталог пуст — выберите клиента/агента и дождитесь загрузки товаров.");
        }
        return false;
      }

      if (!opts?.silent) {
        setApplying(true);
        setApplyError(null);
        setLocalError(null);
      }
      try {
        const params = new URLSearchParams({
          as_of: asOf,
          price_type: pt,
          product_ids: productIds.join(",")
        });
        const { data } = await api.get<PricesAsOfResponse>(
          `/api/${tenantSlug}/orders/prices-as-of?${params.toString()}`
        );
        const map: Record<number, string> = {};
        let missing = 0;
        for (const it of data.items ?? []) {
          if (it.price != null && String(it.price).trim() !== "") {
            map[it.product_id] = String(it.price);
          } else {
            missing += 1;
          }
        }
        if (Object.keys(map).length === 0) {
          if (!opts?.silent) {
            setApplyError(
              "На выбранную дату и тип цены не найдено ни одной цены. Измените параметры или нажмите «Обновить и повторить»."
            );
          }
          return false;
        }

        setPriceType(pt);
        setOldPriceByProductId(map);
        setPriceAsOf(asOf);
        setOldPricesEnabled(true);
        lastFetchedKeyRef.current = `${asOf}|${pt}|${productIdsKey}`;
        if (opts?.updateComment !== false) {
          const auto = buildOldPricesAutoComment(asOf, pt, priceTypeLabels);
          setOrderComment(mergeOldPricesComment(orderComment, auto));
        }

        if (missing > 0 && !opts?.silent) {
          setApplyError(
            `Применено ${Object.keys(map).length} цен; без цены: ${missing}. Можно изменить дату/тип и повторить.`
          );
          return true;
        }

        if (!opts?.silent) {
          setOldPricesOpen(false);
          setApplyError(null);
        }
        return true;
      } catch (e) {
        if (!opts?.silent) {
          setApplyError(getUserFacingError(e, "Не удалось загрузить старые цены."));
        }
        return false;
      } finally {
        if (!opts?.silent) setApplying(false);
      }
    },
    [
      tenantSlug,
      productIds,
      productIdsKey,
      priceTypeLabels,
      orderComment,
      setPriceType,
      setOrderComment,
      setLocalError
    ]
  );

  const applyOldPrices = useCallback(async () => {
    const asOf = draftAsOf.trim();
    const pt = draftPriceType.trim() || "retail";
    await fetchAndApply(asOf, pt, { updateComment: true });
  }, [draftAsOf, draftPriceType, fetchAndApply]);

  /** Katalog o‘zgaganda (agent/klient) — yoqilgan eski narxlarni yangilash. */
  useEffect(() => {
    if (!oldPricesEnabled || !priceAsOf) return;
    const pt = currentPriceType.trim() || "retail";
    const key = `${priceAsOf}|${pt}|${productIdsKey}`;
    if (lastFetchedKeyRef.current === key) return;
    if (productIds.length === 0) return;
    void fetchAndApply(priceAsOf, pt, { silent: true, updateComment: false });
  }, [
    oldPricesEnabled,
    priceAsOf,
    currentPriceType,
    productIdsKey,
    productIds.length,
    fetchAndApply
  ]);

  const onOldPricesOpenChange = useCallback(
    (open: boolean) => {
      if (applying) return;
      setOldPricesOpen(open);
      if (!open) setApplyError(null);
    },
    [applying]
  );

  const onOldPricesCheckboxChange = useCallback(
    (checked: boolean) => {
      if (checked) {
        openOldPricesModal();
        return;
      }
      clearOldPrices();
    },
    [openOldPricesModal, clearOldPrices]
  );

  return {
    oldPricesOpen,
    oldPricesEnabled,
    priceAsOf,
    oldPriceByProductId,
    draftAsOf,
    draftPriceType,
    applyingOldPrices: applying,
    oldPricesApplyError: applyError,
    setDraftAsOf,
    setDraftPriceType,
    openOldPricesModal,
    applyOldPrices,
    clearOldPrices,
    onOldPricesOpenChange,
    onOldPricesCheckboxChange,
    retryOldPrices: applyOldPrices
  };
}
