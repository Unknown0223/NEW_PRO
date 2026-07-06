"use client";

import { ProductAddModal } from "@/components/products/add-product-modal";
import { PageShell } from "@/components/dashboard/page-shell";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();

  if (!hydrated) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      </PageShell>
    );
  }

  if (!tenantSlug) {
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

  return (
    <ProductAddModal
      open
      tenantSlug={tenantSlug}
      onOpenChange={(open) => {
        if (!open) router.push("/products");
      }}
      onDone={() => router.push("/products")}
    />
  );
}
