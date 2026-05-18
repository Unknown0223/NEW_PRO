"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Eski havola: yangi xodim endi asosiy sahifada modal orqali qo‘shiladi. */
export default function LegacySkladchikNewRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings/spravochnik/skladchik");
  }, [router]);
  return <p className="text-sm text-muted-foreground px-2 py-4">Qayta yo‘naltirilmoqda…</p>;
}
