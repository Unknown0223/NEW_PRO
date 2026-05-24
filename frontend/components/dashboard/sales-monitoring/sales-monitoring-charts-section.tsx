"use client";

import type { ReactNode, RefObject } from "react";

export function SalesMonitoringChartsSection({
  sectionRef,
  children
}: {
  sectionRef?: RefObject<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <section ref={sectionRef} aria-label="Доли продаж" data-dashboard-section="sales-monitoring-charts">
      {children}
    </section>
  );
}
