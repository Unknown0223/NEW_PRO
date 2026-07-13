"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Alohida hub yo‘q — guruh ishlov klientlar ro‘yxatidan (belgilash + modal). */
export default function ClientsGroupProcessingRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/clients");
  }, [router]);
  return <p className="p-4 text-sm text-muted-foreground">Klientlar ro‘yxatiga o‘tilmoqda…</p>;
}
