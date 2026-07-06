"use client";

import Link from "next/link";
import { SystemMigrationWorkspace } from "@/components/settings/system-migration/system-migration-workspace";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function SystemMigrationPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tizim migratsiyasi</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            To‘liq zaxira olish va boshqa serverga ko‘chirish. Format v4 — spravochniklar, operatsion tarix,
            bonus/KPI rejalar va mijoz fotolari bitta arxivda.
          </p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Настройки
        </Link>
      </div>
      <SystemMigrationWorkspace />
    </div>
  );
}
