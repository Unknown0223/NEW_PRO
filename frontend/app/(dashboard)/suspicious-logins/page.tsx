"use client";

import { LoginAlertsWorkspace } from "@/components/security/login-alerts-workspace";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuspiciousLoginsInner() {
  const sp = useSearchParams();
  const id = Number.parseInt(sp.get("id") ?? "", 10);
  return <LoginAlertsWorkspace initialAlertId={Number.isFinite(id) && id > 0 ? id : null} />;
}

export default function SuspiciousLoginsPage() {
  return (
    <Suspense fallback={null}>
      <SuspiciousLoginsInner />
    </Suspense>
  );
}
