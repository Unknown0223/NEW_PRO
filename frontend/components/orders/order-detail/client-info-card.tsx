"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { Copy, CreditCard, ExternalLink, Hash, Phone, Store, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OrderDetailCard } from "./info-row";

function parseDec(s: string | null | undefined): number {
  if (s == null || s === "") return 0;
  const n = Number.parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function moneyDisplay(value: string | null | undefined, suffix = " So'm"): string {
  if (value == null || value === "") return "—";
  const n = parseDec(value);
  const formatted = formatNumberGrouped(Math.abs(n), { maxFractionDigits: 0 });
  return `${n < 0 ? "-" : ""}${formatted}${suffix}`;
}

function CopyableClientId({ clientId }: { clientId: number }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(String(clientId)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Нажмите, чтобы скопировать ID"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-mono font-semibold text-foreground transition-colors",
        "hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30",
        copied && "border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
      )}
    >
      <Hash className="size-3 shrink-0 text-muted-foreground" aria-hidden />
      <span>ID: {clientId}</span>
      <Copy className="size-3 shrink-0 opacity-70" aria-hidden />
      {copied ? <span className="text-[10px] font-sans font-normal text-teal-600">Скопировано</span> : null}
    </button>
  );
}

export function ClientInfoCard({ data }: { data: OrderDetailRow }) {
  const clientHref = `/clients/${data.client_id}`;
  const balance = parseDec(data.balance);
  const territory = [data.region, data.city, data.zone].filter((x) => x?.trim()).join(" · ");
  const clientCode = data.client_code?.trim();

  const details = [
    {
      label: "Контактное лицо",
      value: data.client_responsible_person?.trim() || "—",
      icon: Phone,
      badge: false
    },
    {
      label: "Территория",
      value: territory || "—",
      icon: Store,
      badge: true
    },
    {
      label: "Категория",
      value: data.client_category?.trim() || "—",
      icon: User,
      badge: true
    }
  ];

  return (
    <OrderDetailCard
      title="Информация о клиенте"
      action={
        <Link
          href={clientHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 transition-colors hover:text-teal-700"
        >
          Профиль
          <ExternalLink className="size-4" aria-hidden />
        </Link>
      }
    >
      <div className="flex gap-4 rounded-xl bg-muted/40 p-4 ring-1 ring-border/60">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          <div className="text-center">
            <User className="mx-auto size-8 text-muted-foreground/70" aria-hidden />
            <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">
              Фото отсутствует
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{data.client_name}</h3>
          {data.client_legal_name?.trim() ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{data.client_legal_name}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {clientCode ? (
              <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                {clientCode}
              </span>
            ) : null}
            <CopyableClientId clientId={data.client_id} />
          </div>
        </div>
      </div>

      <div className="mt-5 divide-y divide-border/60">
        {details.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
              <span>{item.label}</span>
            </div>
            {item.badge ? (
              <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground">
                {item.value}
              </span>
            ) : (
              <span className="text-sm font-medium text-foreground">{item.value}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/40 p-4 ring-1 ring-border/60">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
            <span>Долг по заказу</span>
          </div>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {moneyDisplay(data.debt)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 p-4 ring-1 ring-border/60">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
            <span>Баланс</span>
          </div>
          <p
            className={cn(
              "text-base font-semibold tabular-nums",
              balance < 0 && "text-red-600 dark:text-red-400",
              balance > 0 && "text-green-600 dark:text-green-400",
              balance === 0 && "text-foreground"
            )}
          >
            {moneyDisplay(data.balance)}
          </p>
        </div>
      </div>
    </OrderDetailCard>
  );
}
