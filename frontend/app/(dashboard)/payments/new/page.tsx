"use client";

import { OrderPaymentWorkspace } from "@/components/payments/order-payment/order-payment-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";

export default function NewPaymentPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated || !tenantSlug) {
    return <p className="p-6 text-sm text-muted-foreground">…</p>;
  }

  return <OrderPaymentWorkspace tenantSlug={tenantSlug} />;
}
