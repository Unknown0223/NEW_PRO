"use client";

import { useEffect, useMemo, useState } from "react";
import { capPolkiExplicitSplit, parsePolkiQty } from "../polki-bonus-balance.logic";
import { polkiProductMaxReturnPool } from "../utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PolkiPairRowModel } from "../types";
import type { PolkiBonusCalcMode } from "../view/polki-shelf-return/polki-bonus-calc";

export type PolkiAllocationMode = "same" | "peresort" | "mixed";

export type PolkiAutoBonusPreviewLine = {
  product_id: number;
  sku: string;
  name: string;
  return_qty: number;
  paid_qty: number;
  bonus_qty: number;
  bonus_cash: number;
  rule_id: number | null;
  rule_name: string | null;
  rule_label: string | null;
  bonus_debt_qty: number;
  bonus_debt_amount: number;
  max_paid: number;
  max_bonus: number;
  bonus_warehouse_product_id: number;
  bonus_warehouse_product_name: string;
  allocation_mode: PolkiAllocationMode;
  peresort_debt_amount: number;
};

export type PolkiAutoBonusPreviewResult = {
  lines: PolkiAutoBonusPreviewLine[];
  totals: {
    paid_qty: number;
    bonus_qty: number;
    bonus_debt_qty: number;
    bonus_debt_amount: string;
    refund_amount: string;
  };
  warnings: string[];
};

export type PolkiExplicitSplit = { paid: number; bonus: number };

const EMPTY_EXPLICIT: Record<string, PolkiExplicitSplit> = {};
const EMPTY_PERESORT: Record<string, number> = {};
const EMPTY_DEBT: Record<string, number> = {};

type UsePolkiAutoBonusInput = {
  tenantSlug: string | null;
  isPolkiFree: boolean;
  isPolkiByOrder: boolean;
  polkiOrderId: number | null;
  polkiBonusCalcMode: PolkiBonusCalcMode;
  canShowPolkiGrid: boolean;
  clientId: string;
  priceType: string;
  selectedCategoryIds: number[];
  polkiDisplayRows: PolkiPairRowModel[];
  polkiTotalQty: Record<string, string>;
};

function syncMapsFromPreview(
  preview: PolkiAutoBonusPreviewResult,
  displayRows: PolkiPairRowModel[],
  totalQty: Record<string, string>,
  applyAutoPeresort: boolean
): {
  explicit: Record<string, PolkiExplicitSplit>;
  peresort: Record<string, number>;
  debtByPairKey: Record<string, number>;
} {
  const byProduct = new Map(preview.lines.map((l) => [l.product_id, l]));
  const productTotals = new Map<number, number>();
  for (const r of displayRows) {
    const q = parsePolkiQty(totalQty[r.pair_key] ?? "");
    if (q <= 0) continue;
    productTotals.set(r.product_id, (productTotals.get(r.product_id) ?? 0) + q);
  }

  const explicit: Record<string, PolkiExplicitSplit> = {};
  const peresort: Record<string, number> = {};
  const debtByPairKey: Record<string, number> = {};

  for (const r of displayRows) {
    const pk = r.pair_key;
    const rowQ = parsePolkiQty(totalQty[pk] ?? "");
    const line = byProduct.get(r.product_id);
    if (!line || rowQ <= 0) continue;

    const prodTotal = productTotals.get(r.product_id) ?? rowQ;
    const share = prodTotal > 0 ? rowQ / prodTotal : 1;
    const paidRaw = Math.floor(line.paid_qty * share + 1e-9);
    const bonusRaw = Math.floor(line.bonus_qty * share + 1e-9);
    explicit[pk] = capPolkiExplicitSplit(r, rowQ, paidRaw, bonusRaw);
    if (
      applyAutoPeresort &&
      line.bonus_qty > 0 &&
      line.bonus_warehouse_product_id !== r.product_id
    ) {
      peresort[pk] = line.bonus_warehouse_product_id;
    }
    if (line.bonus_debt_amount > 0) {
      debtByPairKey[pk] = Math.round(line.bonus_debt_amount * share * 100) / 100;
    }
  }

  return { explicit, peresort, debtByPairKey };
}

export function usePolkiAutoBonus(input: UsePolkiAutoBonusInput) {
  const polkiAutoEnabled = input.isPolkiFree || input.isPolkiByOrder;

  const previewInputLines = useMemo(() => {
    const byProduct = new Map<number, number>();
    for (const r of input.polkiDisplayRows) {
      const q = parsePolkiQty(input.polkiTotalQty[r.pair_key] ?? "");
      if (q <= 0) continue;
      byProduct.set(r.product_id, (byProduct.get(r.product_id) ?? 0) + q);
    }
    return Array.from(byProduct.entries()).map(([product_id, rawQty]) => {
      const poolMax = polkiProductMaxReturnPool(input.polkiDisplayRows, product_id);
      return {
        product_id,
        return_qty: poolMax > 0 ? Math.min(rawQty, poolMax) : 0
      };
    }).filter((l) => l.return_qty > 0);
  }, [input.polkiDisplayRows, input.polkiTotalQty]);

  const [debouncedLines, setDebouncedLines] = useState(previewInputLines);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLines(previewInputLines), 300);
    return () => window.clearTimeout(t);
  }, [previewInputLines]);

  const cid = Number.parseInt(input.clientId, 10);
  const orderId = input.polkiOrderId;
  const canPreview =
    polkiAutoEnabled &&
    input.canShowPolkiGrid &&
    Number.isFinite(cid) &&
    cid > 0 &&
    debouncedLines.length > 0 &&
    (!input.isPolkiByOrder || (orderId != null && orderId > 0));

  const previewQ = useQuery({
    queryKey: [
      "polki-auto-bonus-preview",
      input.tenantSlug,
      cid,
      orderId,
      input.priceType,
      input.selectedCategoryIds,
      debouncedLines
    ] as const,
    enabled: canPreview,
    queryFn: async () => {
      const body: Record<string, unknown> = {
        client_id: cid,
        price_type: input.priceType.trim() || "retail",
        lines: debouncedLines
      };
      if (input.isPolkiByOrder && orderId != null && orderId > 0) {
        body.order_id = orderId;
      }
      if (input.selectedCategoryIds.length > 0) {
        body.category_ids = input.selectedCategoryIds;
      }
      const { data } = await api.post<PolkiAutoBonusPreviewResult>(
        `/api/${input.tenantSlug}/returns/polki-auto-bonus/preview`,
        body
      );
      return data;
    },
    staleTime: 15_000
  });

  const applyAutoPeresort =
    input.isPolkiFree || (input.isPolkiByOrder && input.polkiBonusCalcMode === "auto");

  const { explicitByPairKey, peresortByPairKey, debtByPairKey } = useMemo(() => {
    if (!polkiAutoEnabled) {
      return {
        explicitByPairKey: EMPTY_EXPLICIT,
        peresortByPairKey: EMPTY_PERESORT,
        debtByPairKey: EMPTY_DEBT
      };
    }
    const preview = previewQ.data;
    if (!preview?.lines.length) {
      return {
        explicitByPairKey: EMPTY_EXPLICIT,
        peresortByPairKey: EMPTY_PERESORT,
        debtByPairKey: EMPTY_DEBT
      };
    }
    const synced = syncMapsFromPreview(
      preview,
      input.polkiDisplayRows,
      input.polkiTotalQty,
      applyAutoPeresort
    );
    return {
      explicitByPairKey: synced.explicit,
      peresortByPairKey: synced.peresort,
      debtByPairKey: synced.debtByPairKey
    };
  }, [
    polkiAutoEnabled,
    previewQ.data,
    input.polkiDisplayRows,
    input.polkiTotalQty,
    applyAutoPeresort
  ]);

  const bonusDebtAmount = useMemo(() => {
    if (!previewQ.data) return 0;
    return Number.parseFloat(previewQ.data.totals.bonus_debt_amount) || 0;
  }, [previewQ.data]);

  const previewReady =
    canPreview &&
    !previewQ.isFetching &&
    !previewQ.isError &&
    Boolean(previewQ.data?.lines.length);

  const previewPending = canPreview && (previewQ.isFetching || previewQ.isLoading);

  return {
    polkiAutoBonusPreviewQ: previewQ,
    polkiAutoBonusExplicitByPairKey: explicitByPairKey,
    polkiAutoBonusPeresortByPairKey: peresortByPairKey,
    polkiAutoBonusDebtAmount: bonusDebtAmount,
    polkiAutoBonusDebtByPairKey: debtByPairKey,
    polkiAutoBonusPreviewReady: previewReady,
    polkiAutoBonusPreviewPending: previewPending
  };
}
