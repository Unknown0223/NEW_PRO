"use client";

import { RefusalsPageContent } from "@/components/refusals/refusals-page-content";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Suspense } from "react";

export default function RefusalsPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <RefusalsPageContent />
    </Suspense>
  );
}
