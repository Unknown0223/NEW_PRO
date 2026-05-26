"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Eski `/returns/new?...` → `/orders/new?type=return|return_by_order`. */
export default function ReturnsNewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const orderId = searchParams.get("order_id")?.trim();
    const params = new URLSearchParams();
    params.set("type", orderId ? "return_by_order" : "return");
    const clientId = searchParams.get("client_id");
    if (clientId) params.set("client_id", clientId);
    if (orderId) params.set("order_id", orderId);
    router.replace(`/orders/new?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <PageShell>
      <p className="text-sm text-muted-foreground">Qaytarish sahifasiga yo&apos;naltirilmoqda…</p>
    </PageShell>
  );
}
