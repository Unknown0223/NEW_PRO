"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Eski `/supervisors/new` — to‘liq modal ro‘yxat sahifasida ochiladi. */
export default function NewSupervisorRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/spravochnik/supervisors?create=1");
  }, [router]);
  return <p className="text-sm text-muted-foreground">Форма открывается…</p>;
}
