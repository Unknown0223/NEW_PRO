"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Home, Wallet } from "lucide-react";
import Link from "next/link";

/**
 * Lalaku «Заявки» dagi yuqori qatorga o‘xshash: tezkor havolalar.
 */
export function OrdersHubTopBar() {
  return (
    <div
      className="mb-5 flex min-h-11 flex-wrap items-center gap-2 border-b border-border/70 pb-3 md:min-h-12"
      role="navigation"
      aria-label="Zakazlar tezkor paneli"
    >
      <div className="flex flex-wrap items-center gap-1">
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs sm:text-sm")}
        >
          <Home className="mr-1 size-3.5 opacity-80" aria-hidden />
          Панель управления
        </Link>
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs sm:text-sm")}
        >
          <Wallet className="mr-1 size-3.5 opacity-80" aria-hidden />
          To‘lovlar
        </Link>
      </div>
    </div>
  );
}
