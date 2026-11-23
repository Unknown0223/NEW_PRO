"use client";

import "./supervisor-pro-theme.css";
import { SupervisorProCatalog } from "@/components/dashboard/supervisor/pro/supervisor-pro-catalog";
import { SupervisorProDetailsDialog } from "@/components/dashboard/supervisor/pro/supervisor-pro-details";
import { SupervisorProKpiPanel } from "@/components/dashboard/supervisor/pro/supervisor-pro-kpi";
import { SupervisorProPayments } from "@/components/dashboard/supervisor/pro/supervisor-pro-payments";
import { SupervisorProVisits } from "@/components/dashboard/supervisor/pro/supervisor-pro-visits";
import type {
  SupervisorProDetailView,
  SupervisorProPageProps
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";
import { useEffect, useRef, useState } from "react";

export function SupervisorProPage({
  model,
  loading,
  filtersSlot,
  onOpenPhotos
}: SupervisorProPageProps) {
  const [detail, setDetail] = useState<SupervisorProDetailView | null>(null);
  const activePanelRef = useRef<HTMLElement | null>(null);
  const paymentActive =
    detail?.kind === "payment" ? detail.id : null;

  useEffect(() => {
    if (!detail) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detail]);

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
      className={`supervisor-pro${loading ? " supervisor-pro-loading" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="supervisor-pro-main">
        {filtersSlot}
        <SupervisorProKpiPanel model={model} />
        <div className="sv-middle-grid">
          <SupervisorProPayments
            model={model}
            activeId={paymentActive}
            onOpenDetail={setDetail}
          />
          <SupervisorProVisits
            model={model}
            onOpenDetail={setDetail}
            onOpenPhotos={onOpenPhotos}
          />
        </div>
        <SupervisorProCatalog model={model} onOpenDetail={setDetail} />
      </div>
      {detail ? (
        <SupervisorProDetailsDialog
          view={detail}
          model={model}
          onClose={() => setDetail(null)}
          onOpenPhotos={onOpenPhotos}
        />
      ) : null}
    </div>
  );
}
