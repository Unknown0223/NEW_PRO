import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * WebDataRocks cutover — arxiv sahifa.
 * Query `?keep=1` bilan redirect o‘rniga xabar ko‘rsatiladi.
 */
export default function ReportBuilderWdrArchivedPage({
  searchParams
}: {
  searchParams?: { keep?: string };
}) {
  if (searchParams?.keep !== "1") {
    redirect("/reports/builder/pivot");
  }

  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <h1 className="text-lg font-semibold">WebDataRocks архив</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Конструктор переведён на SavdoDesk Virtual Pivot. Пакет @webdatarocks удалён из зависимостей.
      </p>
      <Link
        href="/reports/builder/pivot"
        className="mt-4 inline-block text-sm font-medium text-primary underline"
      >
        Открыть конструктор сводной таблицы
      </Link>
    </div>
  );
}
