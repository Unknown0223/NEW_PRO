"use client";

import { ClientMapWorkspace } from "@/components/clients/map/client-map-workspace";
import { Suspense } from "react";

export default function ClientsMapPage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Загрузка карты…</p>}>
      <ClientMapWorkspace />
    </Suspense>
  );
}
