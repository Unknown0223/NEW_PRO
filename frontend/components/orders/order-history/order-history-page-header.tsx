"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileDown } from "lucide-react";
import Link from "next/link";

export function OrderHistoryPageHeader({
  orderId,
  backHref
}: {
  orderId: number;
  backHref: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-9 gap-2 border-border bg-card px-3 shadow-sm"
          )}
        >
          <ArrowLeft size={15} aria-hidden />
          Back
        </Link>
        <h1 className="text-xl font-bold text-foreground">История заказа</h1>
        <span className="text-base font-bold text-teal-700 dark:text-teal-400">
          ИД заказа ({orderId})
        </span>
      </div>
      <button
        type="button"
        disabled
        title="Скоро"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-sm"
      >
        <FileDown size={15} aria-hidden />
        Export PDF
      </button>
    </div>
  );
}
