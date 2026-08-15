"use client";

import Link from "next/link";
import { InitialSetupWorkspace } from "@/components/settings/initial-setup/initial-setup-workspace";
import { useAuthStore } from "@/lib/auth-store";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function InitialSetupPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-5 py-5 sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-emerald-100/40 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
              Настройки · Импорт
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Boshlang‘ich sozlash
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Bo‘sh tizimni ketma-ket to‘ldiring: shablon → jadval → qo‘llash. Export va import bir xil Excel
              formatida.
            </p>
          </div>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-lg")}
          >
            ← Настройки
          </Link>
        </div>
      </div>
      <InitialSetupWorkspace tenantSlug={tenantSlug} />
    </div>
  );
}
