"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { ProductCreateWorkspace } from "@/components/products/product-create/product-create-workspace";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";

const BACK = "/settings/products?tab=items";

export default function SettingsProductAddPage() {
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
    <PageShell>
      <PageHeader
        title="Добавление товара"
        description="Полная форма: основной товар и объекты упаковки в одной таблице."
      />
      <SettingsWorkspace>
        <ProductCreateWorkspace
          tenantSlug={tenantSlug}
          backHref={BACK}
          onDone={() => router.push(BACK)}
        />
      </SettingsWorkspace>
    </PageShell>
  );
}
