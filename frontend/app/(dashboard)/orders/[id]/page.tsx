"use client";

import { OrderDetailView, type OrderDetailRow } from "@/components/orders/order-detail-view";
import { NakladnoyExportSettingsDialog } from "@/components/orders/nakladnoy-export-settings-dialog";
import { OrdersHubTopBar } from "@/components/orders/orders-hub-top-bar";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { isAdminOrOperatorLikeRole } from "@/lib/distribution-roles";
import {
  DEFAULT_NAKLADNOY_EXPORT_PREFS,
  downloadOrdersNakladnoyXlsx,
  loadNakladnoyExportPrefs,
  NAKLADNOY_TEMPLATE_OPTIONS,
  type NakladnoyExportPrefs,
  type NakladnoyTemplateId
} from "@/lib/order-nakladnoy";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, History, Printer, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function OrderDetailPage() {
  const params = useParams();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const orderId = Number.parseInt(idStr ?? "", 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();
  const [showPrint, setShowPrint] = useState(false);
  const [nakladnoyTemplate, setNakladnoyTemplate] = useState<NakladnoyTemplateId>("nakladnoy_warehouse");
  const [nakladnoyPrefs, setNakladnoyPrefs] = useState<NakladnoyExportPrefs>(DEFAULT_NAKLADNOY_EXPORT_PREFS);
  const [nakladnoySettingsOpen, setNakladnoySettingsOpen] = useState(false);
  const [nakladnoyFeedback, setNakladnoyFeedback] = useState<string | null>(null);

  const invalid = !Number.isFinite(orderId) || orderId < 1;
  const canNakladnoyExcel = isAdminOrOperatorLikeRole(effectiveRole);

  const orderTitleQ = useQuery({
    queryKey: ["order", tenantSlug, orderId],
    enabled: Boolean(tenantSlug) && !invalid,
    staleTime: STALE.detail,
    queryFn: async () => {
      const { data } = await api.get<OrderDetailRow>(`/api/${tenantSlug}/orders/${orderId}`);
      return data;
    }
  });

  useEffect(() => {
    setNakladnoyPrefs(loadNakladnoyExportPrefs());
  }, []);

  const nakladnoyMut = useMutation({
    mutationFn: async (format: "xlsx" | "pdf" = "xlsx") => {
      await downloadOrdersNakladnoyXlsx({
        tenantSlug: tenantSlug!,
        orderIds: [orderId],
        template: nakladnoyTemplate,
        prefs: nakladnoyPrefs,
        format
      });
    },
    onSuccess: (_data, format) =>
      setNakladnoyFeedback(format === "pdf" ? "PDF yuklab olindi." : "Excel (.xlsx) yuklab olindi."),
    onError: (err: unknown) =>
      setNakladnoyFeedback(getUserFacingError(err, "Nakladnoyni yuklab bo‘lmadi."))
  });

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 200);
  };

  const titleNumber =
    orderTitleQ.data?.number ??
    (orderTitleQ.isLoading ? "…" : invalid ? "—" : String(orderId));

  return (
    <PageShell className="pb-12">
      <OrdersHubTopBar />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/orders"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 w-fit -ml-2 text-muted-foreground"
            )}
          >
            ← Zakazlar ro&apos;yxati
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Заявка: <span className="font-mono text-xl font-semibold">{titleNumber}</span>
          </h1>
        </div>
        {!invalid ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/orders/${orderId}/history`}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 gap-1.5 shrink-0"
              )}
            >
              <History className="size-3.5 opacity-80" aria-hidden />
              Tarix
            </Link>
            <details className="group relative">
              <summary
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 list-none cursor-pointer gap-1.5 marker:content-none [&::-webkit-details-marker]:hidden"
                )}
              >
                Amallar
                <ChevronDown className="size-4 opacity-70 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="absolute right-0 z-30 mt-1 flex min-w-[14rem] max-w-[min(100vw-2rem,20rem)] flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-start gap-2"
                  onClick={handlePrint}
                >
                  <Printer className="size-4 shrink-0" aria-hidden />
                  Chop etish
                </Button>
                {canNakladnoyExcel ? (
                  <div className="space-y-2 border-t border-border/60 pt-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                      Nakladnoy shabloni
                      <select
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                        value={nakladnoyTemplate}
                        onChange={(e) => {
                          setNakladnoyTemplate(e.target.value as NakladnoyTemplateId);
                          setNakladnoyFeedback(null);
                        }}
                        aria-label="Nakladnoy shabloni"
                      >
                        {NAKLADNOY_TEMPLATE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Excel sozlamalari"
                        aria-label="Excel sozlamalari"
                        onClick={() => setNakladnoySettingsOpen(true)}
                      >
                        <Settings className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-9 flex-1 bg-teal-700 text-white hover:bg-teal-800"
                        disabled={nakladnoyMut.isPending}
                        onClick={() => {
                          setNakladnoyFeedback(null);
                          nakladnoyMut.mutate("xlsx");
                        }}
                      >
                        {nakladnoyMut.isPending ? "…" : ".xlsx"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 flex-1"
                        disabled={nakladnoyMut.isPending}
                        onClick={() => {
                          setNakladnoyFeedback(null);
                          nakladnoyMut.mutate("pdf");
                        }}
                      >
                        {nakladnoyMut.isPending ? "…" : ".pdf"}
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
                  <Link
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "h-9 w-full justify-start"
                    )}
                    href={`/payments/new?order_id=${orderId}`}
                  >
                    To&apos;lov qabul
                  </Link>
                  <Link
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "h-9 w-full justify-start"
                    )}
                    href={`/returns?tab=polki&polki_mode=order&order_id=${orderId}`}
                  >
                    Qaytarish (polki)
                  </Link>
                </div>
              </div>
            </details>
          </div>
        ) : null}
      </div>

      {nakladnoyFeedback ? (
        <p
          className={cn(
            "mb-1 rounded-xl border px-3 py-2 text-xs shadow-sm",
            nakladnoyFeedback.includes("bo‘lmadi") || nakladnoyFeedback.includes("xato")
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-border/80 bg-muted/40 text-foreground"
          )}
        >
          {nakladnoyFeedback}
        </p>
      ) : null}

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : invalid ? (
        <p className="text-sm text-destructive">Zakaz identifikatori noto’g’ri.</p>
      ) : (
        <OrderDetailView tenantSlug={tenantSlug} orderId={orderId} showPrintView={showPrint} />
      )}

      <NakladnoyExportSettingsDialog
        open={nakladnoySettingsOpen}
        onOpenChange={setNakladnoySettingsOpen}
        prefs={nakladnoyPrefs}
        onSave={(next) => {
          setNakladnoyPrefs(next);
          setNakladnoyFeedback(null);
        }}
      />
    </PageShell>
  );
}
