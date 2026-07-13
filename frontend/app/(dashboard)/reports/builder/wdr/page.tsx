import dynamic from "next/dynamic";
import Link from "next/link";

const WdrReportBuilder = dynamic(() => import("@/components/reports/wdr-report-builder"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted-foreground">Загрузка конструктора WebDataRocks…</p>
});

/** WebDataRocks fallback — rollback uchun saqlangan. */
export default function ReportBuilderWdrPage() {
  return (
    <div className="flex h-full min-h-0 flex-col p-3 md:p-4">
      <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        WebDataRocks arxivlangan rollback marshruti. Yangi hisobotlar uchun{" "}
        <Link href="/reports/builder/pivot" className="font-medium underline">
          Virtual Pivot konstruktor
        </Link>{" "}
        dan foydalaning.
      </div>
      <WdrReportBuilder />
    </div>
  );
}
