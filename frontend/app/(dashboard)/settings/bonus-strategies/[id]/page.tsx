"use client";

import { BonusStrategyForm } from "@/components/bonus-strategies/bonus-strategy-form";
import type { BonusStrategyRow } from "@/components/bonus-strategies/bonus-strategy-types";
import { PageShell } from "@/components/dashboard/page-shell";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function EditBonusStrategyPage() {
  const params = useParams();
  const id = Number.parseInt(String(params?.id ?? ""), 10);
  const tenantSlug = useAuthStore((s) => s.tenantSlug);

  const q = useQuery({
    queryKey: ["bonus-strategies", tenantSlug, id],
    enabled: Boolean(tenantSlug) && Number.isInteger(id) && id > 0,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<BonusStrategyRow>(`/api/${tenantSlug}/bonus-strategies/${id}`);
      return data;
    }
  });

  if (!Number.isInteger(id) || id < 1) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Неверный id</p>
      </PageShell>
    );
  }

  if (q.isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      </PageShell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">{getUserFacingError(q.error, "Не найдено")}</p>
      </PageShell>
    );
  }

  return <BonusStrategyForm initial={q.data} />;
}
