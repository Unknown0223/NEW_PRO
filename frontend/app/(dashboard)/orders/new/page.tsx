"use client";

import dynamic from "next/dynamic";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/use-permissions";
import { orderCreatePageAccess } from "@/lib/order-create-access";
import { AccessDeniedBanner } from "@/components/access/access-denied-banner";

const OrderCreateWorkspace = dynamic(
  () =>
    import("@/components/orders/order-create-workspace").then((m) => ({
      default: m.OrderCreateWorkspace
    })),
  {
    loading: () => <p className="text-sm text-muted-foreground">Загрузка формы заказа…</p>
  }
);

function NewOrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Загрузка сессии…</p>;
  }

  if (!tenantSlug) {
    return (
      <p className="text-sm text-destructive">
        <Link href="/login" className="underline">
          Войти снова
        </Link>
      </p>
    );
  }

  const orderType = (searchParams.get("type") ?? "order").trim();
  const isPolkiReturn = orderType === "return" || orderType === "return_by_order";
  const editRaw = searchParams.get("edit_order_id")?.trim() ?? "";
  const editParsed = Number.parseInt(editRaw, 10);
  const editOrderId =
    Number.isFinite(editParsed) && editParsed > 0 ? editParsed : null;
  const access = orderCreatePageAccess(orderType, editOrderId);

  if (perms.isLoading && !perms.isAdmin) {
    return <p className="text-sm text-muted-foreground">Проверка доступа…</p>;
  }
  if (!perms.hasAny(...access.anyOf)) {
    return (
      <div className="flex flex-1 items-start justify-center p-6 sm:p-10">
        <AccessDeniedBanner
          title="Нет доступа"
          message={`Раздел «${access.label}» недоступен для вашей роли или прав.`}
          secondaryHref="/access"
          secondaryLabel="Доступ"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        isPolkiReturn &&
          "polki-return-page -mx-2 w-[calc(100%+1rem)] max-w-none sm:-mx-3 sm:w-[calc(100%+1.5rem)] md:-mx-4 md:w-[calc(100%+2rem)]"
      )}
    >
      <OrderCreateWorkspace
        tenantSlug={tenantSlug}
        onCreated={() => router.push("/orders")}
        onCancel={() => router.push("/orders")}
        orderType={orderType}
        editOrderId={editOrderId}
      />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Загрузка…</p>}>
      <NewOrderContent />
    </Suspense>
  );
}
