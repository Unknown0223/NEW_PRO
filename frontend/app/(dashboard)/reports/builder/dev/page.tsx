"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "@salec/pivot-engine";
import { PivotTable } from "@/components/pivot/PivotTable";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isVirtualPivotActive } from "@/lib/pivot-bridge";

const MOCK_ROWS = [
  { region: "Toshkent", product: "Mahsulot A", month: "Yan", amount: 1_500_000, qty: 120 },
  { region: "Toshkent", product: "Mahsulot B", month: "Yan", amount: 800_000, qty: 45 },
  { region: "Toshkent", product: "Mahsulot A", month: "Fev", amount: 900_000, qty: 80 },
  { region: "Samarqand", product: "Mahsulot A", month: "Yan", amount: 2_100_000, qty: 200 },
  { region: "Buxoro", product: "Mahsulot C", month: "Fev", amount: 450_000, qty: 30 }
];

const MOCK_FIELDS = [
  { id: "region", label: "Hudud", dataType: "string" as const },
  { id: "product", label: "Mahsulot", dataType: "string" as const },
  { id: "month", label: "Oy", dataType: "string" as const },
  { id: "amount", label: "Summa (UZS)", dataType: "currency" as const, format: { type: "currency" as const, currency: "UZS" as const } },
  { id: "qty", label: "Miqdor", dataType: "number" as const }
];

export default function PivotEngineDevPage() {
  const enabled = isVirtualPivotActive();

  const config = useMemo(
    () => ({
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" as const }]
    }),
    []
  );

  const pivotData = useMemo(() => {
    if (!enabled) return null;
    const engine = new PivotEngine();
    return engine.compute(MOCK_ROWS, MOCK_FIELDS, config);
  }, [enabled, config]);

  if (!enabled) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-lg font-semibold">Virtual Pivot Engine — Dev</h1>
        <p className="text-sm text-muted-foreground">
          Feature flag o&apos;chirilgan. <code>frontend/.env.local</code> ga{" "}
          <code>NEXT_PUBLIC_PIVOT_ENGINE=1</code> qo&apos;ying va dev serverni qayta ishga tushiring.
        </p>
        <Link
          href="/reports/builder/pivot"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs")}
        >
          Virtual Pivot konstruktor (flag siz ham ishlaydi)
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Virtual Pivot Engine — Dev (Phase B)</h1>
        <p className="text-sm text-muted-foreground">
          PivotEngine.ts — to&apos;liq pivot jadval (qator × ustun × qiymat).
        </p>
      </div>

      {pivotData && (
        <PivotTable
          data={pivotData}
          config={config}
          expandedRows={new Set()}
          onToggleRow={() => {}}
        />
      )}

      <div className="flex gap-2">
        <Link
          href="/reports/builder/pivot"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "text-xs")}
        >
          To&apos;liq konstruktor
        </Link>
      </div>
    </div>
  );
}
