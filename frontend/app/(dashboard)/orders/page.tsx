"use client";

import { OrdersPageContent } from "@/components/orders/orders-list/orders-page-content";
import { useOrdersListPage } from "@/components/orders/orders-list/use-orders-list-page";
import { Suspense } from "react";

function OrdersPageInner() {
  const page = useOrdersListPage();
  return <OrdersPageContent page={page} />;
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Загрузка…</div>
      }
    >
      <OrdersPageInner />
    </Suspense>
  );
}
