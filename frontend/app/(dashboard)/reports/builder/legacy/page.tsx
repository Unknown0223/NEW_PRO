import { ReportBuilderWorkspace } from "@/components/reports/report-builder-workspace";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function ReportBuilderLegacyPage() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/reports/builder" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}>
          Новая версия (WebDataRocks)
        </Link>
        <span className="text-xs text-muted-foreground">Старый конструктор (dnd-kit + серверный preview)</span>
      </div>
      <ReportBuilderWorkspace />
    </div>
  );
}
