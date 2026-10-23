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
          <h1 className="text-lg font-semibold tracking-tight">Миграция системы</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Полная резервная копия и перенос на другой сервер. Формат v5 — справочники, история операций,
            бонусы/KPI, RBAC/каталог и фото клиентов в одном архиве.
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
