import { redirect } from "next/navigation";

/** Eski alohida sahifa → asosiy «Балансы клиентов» ichidagi «По консигнации» tab. */
export default function ConsignmentClientBalancesPage() {
  redirect("/client-balances?view=clients_consignment");
}
