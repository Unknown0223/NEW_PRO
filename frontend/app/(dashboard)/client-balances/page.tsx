"use client";

import { ClientBalancesWorkspace } from "@/components/client-balances/client-balances-workspace";
import { Suspense } from "react";

export default function ClientBalancesPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Загрузка…</p>}>
      <ClientBalancesWorkspace />
    </Suspense>
  );
}
