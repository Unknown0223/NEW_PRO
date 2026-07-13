import dynamic from "next/dynamic";

const WdrReportBuilder = dynamic(() => import("@/components/reports/wdr-report-builder"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted-foreground">Загрузка конструктора…</p>
});

export default function ReportBuilderPage() {
  return <WdrReportBuilder />;
}
