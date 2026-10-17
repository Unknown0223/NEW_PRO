"use client";

import { ClientGroupProcessingWorkspace } from "@/components/clients/group-processing/client-group-processing-workspace";
import { Suspense } from "react";

export default function ClientsGroupProcessingPage() {
  return (
    <div className="relative min-h-0 w-full flex-1">
      <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Загрузка…</p>}>
        <ClientGroupProcessingWorkspace />
      </Suspense>
    </div>
  );
}
