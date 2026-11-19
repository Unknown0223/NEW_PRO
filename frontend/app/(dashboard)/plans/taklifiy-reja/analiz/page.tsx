import { redirect } from "next/navigation";

/** Eski «Analiz» yo‘li — asosiy hisob-kitobga. */
export default function TaklifiyAnalizRedirectPage() {
  redirect("/plans/taklifiy-reja");
}
