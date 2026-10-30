"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
export default function SpravochnikPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const effectiveRole = useEffectiveRole();

  const users = useQuery({
    queryKey: ["ref-users", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; login: string; name: string; role: string }[] }>(
        `/api/${tenantSlug}/users`
      );
      return data.data;
    }
  });

  const categories = useQuery({
    queryKey: ["product-categories", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { id: number; name: string; parent_id: number | null }[] }>(
        `/api/${tenantSlug}/product-categories`
      );
      return data.data;
    }
  });

  const priceTypes = useQuery({
    queryKey: ["price-types", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: string[] }>(`/api/${tenantSlug}/price-types`);
      return data.data;
    }
  });

  const profile = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references: { payment_types: string[]; return_reasons: string[]; regions: string[] };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h1 className="text-lg font-semibold">Справочники</h1>
        <p className="text-sm text-muted-foreground">Пользователи, категории, типы цен</p>
        <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/dashboard">
          ← Дашборд
        </Link>
      </div>

      <section className="rounded-lg border border-primary/25 bg-primary/5 p-4">
        <h2 className="text-sm font-semibold">Единый каталог настроек</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Все разделы доступны через каталог на левой панели: территория, филиалы, цены, оборудование и другое.
        </p>
        <Link
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-3 inline-flex")}
          href="/settings"
        >
          Перейти в каталог настроек
        </Link>
      </section>

      {!hydrated || !tenantSlug ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : (
        <>
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Управление складом</h2>
            <p className="text-xs text-muted-foreground">
              Настройки склада перенесены в отдельный раздел.
            </p>
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/stock/warehouses">
              Открыть страницу складов
            </Link>
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Списки выбора для карточки клиента</h2>
            <p className="text-xs text-muted-foreground">
              Категория, тип, формат, канал продаж, район, махалля, зона, логистика — для выпадающих списков при
              редактировании клиента.
            </p>
            <Link
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
              href="/settings/spravochnik/client-lists"
            >
              Управление справочниками клиентов
            </Link>
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Пользователи</h2>
            <div className="flex flex-wrap gap-2">
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/settings/spravochnik/agents">
                Раздел агентов
              </Link>
              <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/settings/spravochnik/expeditors">
                Раздел экспедиторов
              </Link>
              <Link
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                href="/settings/spravochnik/supervisors"
              >
                Супервайзеры
              </Link>
              {effectiveRole === "admin" ? (
                <Link
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  href="/settings/spravochnik/operators"
                >
                  Веб-сотрудники
                </Link>
              ) : null}
            </div>
            {users.isLoading ? (
              <p className="text-xs text-muted-foreground">Загрузка</p>
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {(users.data ?? []).map((u) => (
                  <li key={u.id}>
                    {u.name} ({u.login}) — {u.role}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Категории товаров</h2>
            <p className="text-xs text-muted-foreground">
              Категории, группы и подкатегории управляются через таблицу и модальное окно.
            </p>
            <Link className={cn(buttonVariants({ variant: "default", size: "sm" }))} href="/settings/product-categories">
              Настройки: Категория продукта
            </Link>
            <p className="text-xs text-muted-foreground">
              Всего записей: {(categories.data ?? []).length} (все уровни)
            </p>
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Типы цен (БД + каталог)</h2>
            <Link className={cn(buttonVariants({ variant: "default", size: "sm" }))} href="/settings/price-types">
              Настройки: Тип цены
            </Link>
            {priceTypes.isLoading ? (
              <p className="text-xs text-muted-foreground">Загрузка</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {(priceTypes.data ?? []).join(", ") || "—"}
              </p>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">Справочники компании (только чтение)</h2>
            <p className="text-xs text-muted-foreground">
              Редактирование:{" "}
              <Link className="text-primary underline" href="/settings/company">
                Настройки компании
              </Link>
            </p>
            {profile.data ? (
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <p className="font-medium">Способы оплаты</p>
                  <p className="text-muted-foreground">{(profile.data.references.payment_types ?? []).join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium">Возврат</p>
                  <p className="text-muted-foreground">
                    {(profile.data.references.return_reasons ?? []).join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Территории</p>
                  <p className="text-muted-foreground">{(profile.data.references.regions ?? []).join(", ") || "—"}</p>
                </div>
              </div>
            ) : null}
          </section>

        </>
      )}
    </div>
  );
}
