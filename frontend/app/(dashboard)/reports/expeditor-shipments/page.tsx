"use client";

/**
 * SalesDoc `/report/expeditor` — dedicated matrix (not FlatReport).
 * Dual header + category tree + invoice footer.
 */
import { ExpeditorShipmentsWorkspace } from "@/components/reports/expeditor-shipments/expeditor-shipments-workspace";

export default function ReportExpeditorShipmentsPage() {
  return <ExpeditorShipmentsWorkspace />;
}
