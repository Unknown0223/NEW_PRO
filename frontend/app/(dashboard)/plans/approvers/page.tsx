"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ApprovalWorkflowWorkspace } from "@/components/plans/approval-workflow-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

function ApproversPageInner() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();

  if (!hydrated) return <p className="p-6 text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Сессия не найдена. <Link href="/login" className="text-primary underline">Войти</Link>
      </p>
    );
  }
  if (!perms.isLoading && !perms.has("plans.nastroyka_utverzhdayushchih.view")) {
    return <p className="p-6 text-sm text-muted-foreground">Нет доступа к этому разделу.</p>;
  }

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Настройка утверждающих</h1>
        <p className="text-sm text-muted-foreground">
          Цепочка утверждения заказов по направлениям торговли и супервайзерам.
        </p>
      </div>
      <ApprovalWorkflowWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}

export default function PlansApproversPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Загрузка…</p>}>
      <ApproversPageInner />
    </Suspense>
  );
}
