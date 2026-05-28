import { redirect } from "next/navigation";

/** Eski «Список возвратов» → автоматизация заявок. */
export default function ReturnsListRedirect() {
  redirect("/orders/automation");
}
