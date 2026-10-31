"use client";

import {
  buildPaymentMethodLabelMap,
  resolvePaymentMethodDisplayLabel
} from "@/lib/payment-method-options";
import { useMemo } from "react";

export function useSalesPaymentDisplay(
  paymentEntries: Array<{ id: string; name: string; code?: string | null }> | undefined
) {
  return useMemo(() => {
    const map = buildPaymentMethodLabelMap(paymentEntries);
    return (ref: string) => resolvePaymentMethodDisplayLabel(ref, map);
  }, [paymentEntries]);
}
