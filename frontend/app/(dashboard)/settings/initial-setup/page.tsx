"use client";

import Link from "next/link";
import { InitialSetupWorkspace } from "@/components/settings/initial-setup/initial-setup-workspace";
import { useAuthStore } from "@/lib/auth-store";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function InitialSetupPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Boshlang‘ich sozlash</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Bo‘sh tizimni tez ishga tushirish: ketma-ket import, vizual ko‘rib chiqish va qo‘llash bir
            joyda.
          </p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Настройки
        </Link>
      </div>
      <InitialSetupWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
