"use client";

import type { BonusRuleRow } from "@/components/bonus-rules/bonus-rule-types";
import { BonusRuleForm } from "@/components/bonus-rules/bonus-rule-form";
import { BonusRuleFormPageHeader } from "@/components/bonus-rules/bonus-rule-form-page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { readBonusRuleCloneDraft } from "@/lib/bonus-rule-clone-draft";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NewDiscountRulePage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const [clonePack, setClonePack] = useState<{ rule: BonusRuleRow; nonce: string } | null>(null);
  useEffect(() => {
    const rule = readBonusRuleCloneDraft("discount");
    if (rule) setClonePack({ rule, nonce: `clone-${Date.now()}` });
  }, []);

  return (
    <PageShell>
      <BonusRuleFormPageHeader variant="discount" mode={clonePack ? "clone" : "new"} />

      {!authHydrated ? (
        <p className="text-sm text-muted-foreground">Загрузка сессии…</p>
      ) : !tenantSlug ? (
        <p className="text-sm text-destructive">
          <Link href="/login" className="underline">
            Войти снова
          </Link>
        </p>
      ) : (
        <BonusRuleForm
          tenantSlug={tenantSlug}
          initialRule={clonePack?.rule ?? null}
          prefillNonce={clonePack?.nonce ?? null}
          variant="discountOnly"
        />
      )}
    </PageShell>
  );
}
