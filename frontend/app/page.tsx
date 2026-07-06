import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME } from "@/lib/auth-sync";

/**
 * Ildiz `/` — alohida landing sahifa yo'q. Sessiya cookie'siga qarab:
 * kirgan bo'lsa — supervayzer dashboardiga, aks holda — login sahifasiga.
 * (Asosiy yo'naltirish `middleware.ts` da bajariladi; bu — zaxira.)
 */
export default function Home() {
  const authed = cookies().get(AUTH_COOKIE_NAME)?.value === "1";
  redirect(authed ? "/dashboard" : "/login");
}
