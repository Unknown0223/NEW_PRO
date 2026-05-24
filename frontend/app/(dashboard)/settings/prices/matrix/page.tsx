"use client";

import { PageShell } from "@/components/dashboard/page-shell";
import Link from "next/link";
import { PriceMatrixPageView } from "./price-matrix-page-view";
import { usePriceMatrixPage } from "./use-price-matrix-page";

export default function PriceMatrixPage() {
  const state = usePriceMatrixPage();
  const { hydrated, tenantSlug } = state;

  if (!hydrated) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Sessiya...</p>
      </PageShell>
    );
  }
  if (!tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Kirish
          </Link>
        </p>
      </PageShell>
    );
  }

  return <PriceMatrixPageView {...state} />;
}
