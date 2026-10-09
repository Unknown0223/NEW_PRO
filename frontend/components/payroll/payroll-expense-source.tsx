import Link from "next/link";

const LABEL: Record<string, string> = { payroll_advance: "Аванс", payroll_salary: "Зарплата" };

export function isPayrollExpense(sourceType: string | null | undefined): boolean {
  return sourceType != null && sourceType in LABEL;
}

/** Xarajat zarplata/avans to'lovidan yaratilgan bo'lsa — manba belgisi (tahrirlab bo'lmaydi). */
export function PayrollExpenseSource({ sourceType, sourceId }: { sourceType?: string | null; sourceId?: number | string | null }) {
  if (!isPayrollExpense(sourceType)) return null;
  return (
    <Link href="/finance/cashier-queue" className="block text-[11px] text-violet-700 hover:underline" title="Изменяется только через выплату в кассе">
      Источник: {LABEL[sourceType as string]} #{sourceId ?? "—"}
    </Link>
  );
}
