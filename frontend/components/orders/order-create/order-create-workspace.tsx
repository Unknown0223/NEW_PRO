"use client";

import type { OrderCreateProps } from "./types";
import { useOrderCreate } from "./hooks/use-order-create";
import { OrderCreateView } from "./view/order-create-view";
import { PageShell } from "@/components/dashboard/page-shell";
import Link from "next/link";

export function OrderCreateWorkspace(props: OrderCreateProps) {
  const vm = useOrderCreate(props);
  if (!vm.tenantSlug) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      </PageShell>
    );
  }
  return <OrderCreateView vm={vm} />;
}
