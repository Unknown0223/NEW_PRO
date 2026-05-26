"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function OrderDetailBreadcrumbs({
  orderNumber
}: {
  orderNumber: string;
}) {
  const items = [
    { label: "Заявки", href: "/orders" as const },
    { label: `Заявка: ${orderNumber}` }
  ];

  return (
    <nav className="mb-4 flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <div key={item.label} className="flex min-w-0 items-center gap-2">
          {index > 0 ? (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : null}
          {"href" in item && item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-teal-600"
            >
              {item.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
