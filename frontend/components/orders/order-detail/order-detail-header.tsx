"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { HistoryIconButton } from "@/components/history/history-icon-button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function OrderDetailHeader({
  orderNumber,
  orderId,
  actions
}: {
  orderNumber: string;
  orderId: number;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href="/orders"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Заявки ro'yxatiga"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
          Заявка: <span className="font-mono">{orderNumber}</span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/orders/${orderId}/history`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-10 gap-2 border-border bg-card px-4 shadow-sm"
          )}
        >
          <Clock className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium">История заказа</span>
        </Link>
        <HistoryIconButton
          module="orders"
          section="zakaz"
          entityType="order"
          entityId={orderId}
          variant="outline"
          size="icon"
          title="История заказа (быстрый просмотр)"
        />
        {actions}
      </div>
    </div>
  );
}
