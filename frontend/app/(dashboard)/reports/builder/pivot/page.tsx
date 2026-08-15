import dynamic from "next/dynamic";

const VirtualPivotReportBuilder = dynamic(
  () =>
    import("@/components/reports/virtual-pivot-report-builder").then((m) => m.VirtualPivotReportBuilder),
  {
    ssr: false,
    loading: () => (
      <p className="p-4 text-sm text-muted-foreground">Pivot konstruktor yuklanmoqda…</p>
    )
  }
);

export default function PivotReportBuilderPage() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <VirtualPivotReportBuilder />
    </div>
  );
}
