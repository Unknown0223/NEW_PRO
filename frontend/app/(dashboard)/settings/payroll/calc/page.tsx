"use client";

import { Suspense } from "react";
import Link from "next/link";
import { CalcWorkspace } from "@/components/payroll/calc-workspace";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

function CalcPageInner() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();

  if (!hydrated) return <p className="p-6 text-sm text-muted-foreground">Sessiya yuklanmoqda…</p>;
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Сессия не найдена.{" "}
        <Link href="/login" className="text-primary underline">
          Войти
        </Link>
      </p>
    );
  }
  if (!perms.isLoading && !perms.has("staff.zarplaty.view")) {
    return <p className="p-6 text-sm text-muted-foreground">Bu bo‘limga ruxsat yo‘q.</p>;
  }

  return <CalcWorkspace tenantSlug={tenantSlug} />;
}

export default function PayrollCalcPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Yuklanmoqda…</p>}>
      <CalcPageInner />
    </Suspense>
  );
}
