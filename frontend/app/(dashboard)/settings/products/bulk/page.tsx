"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { ProductBulkAddPanel } from "@/components/products/product-bulk-add-panel";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { useAuthStore } from "@/lib/auth-store";
import { useQueryClient } from "@tanstack/react-query";

const BACK = "/settings/products?tab=items";

export default function SettingsProductsBulkPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const qc = useQueryClient();

  return (
    <PageShell>
      <PageHeader
        title="Добавление нескольких товаров"
        description="Введите несколько товаров в таблице. Для каждой заполненной строки обязательны категория, название и единица измерения."
      />
      <SettingsWorkspace>
        <ProductBulkAddPanel
          tenantSlug={tenantSlug}
          backHref={BACK}
          showCardHeader={false}
          onDone={() => void qc.invalidateQueries({ queryKey: ["products", tenantSlug] })}
        />
      </SettingsWorkspace>
    </PageShell>
  );
}
