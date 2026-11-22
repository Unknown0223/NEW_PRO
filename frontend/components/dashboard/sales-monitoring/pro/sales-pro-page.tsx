"use client";

import "./sales-pro-theme.css";
import { SalesProCategoryDonut } from "@/components/dashboard/sales-monitoring/pro/sales-pro-category-donut";
import { SalesProDetailsDialog } from "@/components/dashboard/sales-monitoring/pro/sales-pro-details-dialog";
import { SalesProDynamicsChart } from "@/components/dashboard/sales-monitoring/pro/sales-pro-dynamics-chart";
import { SalesProKpiPanels } from "@/components/dashboard/sales-monitoring/pro/sales-pro-kpi-panels";
import { SalesProSummaryCards } from "@/components/dashboard/sales-monitoring/pro/sales-pro-summary-cards";
import { SalesProTables } from "@/components/dashboard/sales-monitoring/pro/sales-pro-tables";
import type {
  SalesProDetailView,
  SalesProPageProps
} from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { useEffect, useRef, useState } from "react";

export function SalesProPage({ model, loading, monthLabel }: SalesProPageProps) {
  const [detail, setDetail] = useState<SalesProDetailView | null>(null);
  const activePanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!detail) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detail]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const shell = event.currentTarget;
    shell.style.setProperty("--pointer-x", `${event.clientX}px`);
    shell.style.setProperty("--pointer-y", `${event.clientY}px`);
    const target = event.target;
    const panel = target instanceof Element ? target.closest<HTMLElement>(".panel") : null;
    if (activePanelRef.current && activePanelRef.current !== panel) {
      activePanelRef.current.style.removeProperty("--spot-x");
      activePanelRef.current.style.removeProperty("--spot-y");
    }
    activePanelRef.current = panel;
    if (panel) {
      const bounds = panel.getBoundingClientRect();
      panel.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      panel.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--pointer-x", "50vw");
    event.currentTarget.style.setProperty("--pointer-y", "32vh");
    activePanelRef.current?.style.removeProperty("--spot-x");
    activePanelRef.current?.style.removeProperty("--spot-y");
    activePanelRef.current = null;
  };

  return (
    <div
      className={`sales-pro${loading ? " sales-pro-loading" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="sales-pro-main">
        <SalesProSummaryCards model={model} monthLabel={monthLabel} onOpenDetail={setDetail} />
        <div className="analytics-grid">
          <SalesProDynamicsChart model={model} onOpenDetail={setDetail} />
          <SalesProCategoryDonut model={model} onOpenDetail={setDetail} />
        </div>
        <SalesProKpiPanels model={model} monthLabel={monthLabel} onOpenDetail={setDetail} />
        <SalesProTables model={model} onOpenDetail={setDetail} />
      </div>
      {detail ? (
        <SalesProDetailsDialog
          view={detail}
          model={model}
          monthLabel={monthLabel}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}
