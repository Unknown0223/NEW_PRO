"use client";

import type { BonusRuleRow } from "@/components/bonus-rules/bonus-rule-types";
import { BonusRuleForm } from "@/components/bonus-rules/bonus-rule-form";
import { BonusRuleFormPageHeader } from "@/components/bonus-rules/bonus-rule-form-page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { getUserFacingError } from "@/lib/error-utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EditDiscountRulePage() {
  const params = useParams();
  const router = useRouter();
  const raw = params.id;
  const idStr = Array.isArray(raw) ? raw[0] : raw;
  const ruleId = Number.parseInt(idStr ?? "", 10);
  const invalid = !Number.isFinite(ruleId) || ruleId < 1;

  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["bonus-rule", tenantSlug, ruleId],
    enabled: Boolean(tenantSlug) && !invalid,
    staleTime: STALE.detail,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: body } = await api.get<BonusRuleRow>(`/api/${tenantSlug}/bonus-rules/${ruleId}`);
      return body;
    }
  });

  useEffect(() => {
    if (!data) return;
    if (data.type === "qty") {
      router.replace(`/settings/bonus-rules/${ruleId}/edit`);
    }
  }, [data, ruleId, router]);

  return (
    <PageShell>
      {data && data.type !== "qty" ? (
        <BonusRuleFormPageHeader variant="discount" mode="edit" ruleName={data.name} />
      ) : (
        <BonusRuleFormPageHeader variant="discount" mode="edit" />
      )}

      {!authHydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : invalid ? (
        <p className="text-sm text-destructive">Некорректный идентификатор правила.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {getUserFacingError(error, "Правило не найдено или ошибка")}
        </p>
      ) : data && data.type === "qty" ? (
        <p className="text-sm text-muted-foreground">Переход в раздел бонусов…</p>
      ) : data ? (
        <BonusRuleForm
          key={`${data.id}:${data.updated_at ?? ""}`}
          tenantSlug={tenantSlug}
          initialRule={data}
          variant="discountOnly"
        />
      ) : (
        <p className="text-sm text-destructive">Нет данных.</p>
      )}
    </PageShell>
  );
}
