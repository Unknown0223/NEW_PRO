import { redirect } from "next/navigation";

/** Справочник перенесён в раздел «Поставщики» бокового меню. */
export default function SuppliersSettingsRedirectPage() {
  redirect("/suppliers");
}
