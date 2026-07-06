"use client";

import { BoundaryDrawCanvas } from "@/components/geo-boundaries/boundary-draw-canvas";
import { GeoBoundaryToolbar } from "@/components/geo-boundaries/geo-boundary-toolbar";
import { GeoBoundaryOverlapModal } from "@/components/geo-boundaries/geo-boundary-overlap-modal";
import { useGeoBoundaryEditorState } from "@/components/geo-boundaries/use-geo-boundary-editor-state";
import { useVisitPlannerCatalog } from "@/hooks/use-visit-planner-catalog";
import { VisitPlannerMapTools } from "@/components/clients/visit-planner/visit-planner-map-tools";
import {
  VisitPlannerYandexMap,
  type VisitMapControls
} from "@/components/clients/visit-planner/visit-planner-yandex-map";
import { VISIT_PLANNER_CSS } from "@/components/clients/visit-planner/visit-planner-styles";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import Link from "next/link";
import { useEffect, useRef } from "react";

export function GeoBoundariesWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const authHydrated = useAuthStoreHydrated();
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<VisitMapControls | null>(null);
  const editor = useGeoBoundaryEditorState(tenantSlug);
  const { profileQ } = useVisitPlannerCatalog(tenantSlug);

  useEffect(() => {
    if (!tenantSlug) return;
    void profileQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const lassoDrawActive = editor.drawActive && editor.drawStyle === "lasso";
  const clickDrawActive = editor.drawActive && editor.drawStyle === "click";

  useEffect(() => {
    const center = editor.mapFocusCenter;
    if (!editor.geoRefId || !center) return;
    controlsRef.current?.panTo(center.lat, center.lng, editor.usesAdminBoundary ? 8 : 11);
  }, [editor.geoRefId, editor.mapFocusCenter?.lat, editor.mapFocusCenter?.lng, editor.usesAdminBoundary]);

  useEffect(() => {
    const poly = editor.selectedBoundary?.polygon;
    if (!editor.geoRefId || !poly || poly.length < 3 || editor.usesAdminBoundary) return;
    const lat = poly.reduce((a, p) => a + p.lat, 0) / poly.length;
    const lon = poly.reduce((a, p) => a + p.lng, 0) / poly.length;
    controlsRef.current?.panTo(lat, lon, 12);
  }, [editor.geoRefId, editor.selectedBoundary?.id, editor.selectedBoundary?.polygon.length, editor.usesAdminBoundary]);

  useEffect(() => {
    if (!editor.feedback) return;
    const t = setTimeout(() => editor.setFeedback(null), 4200);
    return () => clearTimeout(t);
  }, [editor.feedback, editor.setFeedback]);

  useEffect(() => {
    if (lassoDrawActive) {
      controlsRef.current?.setLassoActive(true);
      controlsRef.current?.setBoundaryDrawActive(false);
      return;
    }
    controlsRef.current?.setLassoActive(false);
    controlsRef.current?.setBoundaryDrawActive(clickDrawActive);
  }, [lassoDrawActive, clickDrawActive]);

  if (!authHydrated) {
    return <p className="p-6 text-sm text-muted-foreground">Sessiya yuklanmoqda…</p>;
  }
  if (!tenantSlug) {
    return <p className="p-6 text-sm text-destructive">Tenant topilmadi.</p>;
  }

  return (
    <div className="vp-geo-settings-wrap vp-geo-settings-full">
      <style dangerouslySetInnerHTML={{ __html: VISIT_PLANNER_CSS }} />
      <div ref={mapShellRef} className="vp-app vp-geo-settings">
        <VisitPlannerYandexMap
          points={[]}
          selectedIds={new Set()}
          clickSelectMode={false}
          onToggle={() => {}}
          onInfo={() => {}}
          onMapClick={() => {}}
          onMapLatLngClick={(lat, lon) => {
            if (clickDrawActive) editor.addDrawPoint(lat, lon);
          }}
          polygons={editor.mapPolygons}
          draftPolygon={editor.draftCoords}
          draftColor={editor.effectiveColor}
          draftPulse={editor.draftPulse}
          boundaryDrawMode={clickDrawActive}
          controlsRef={controlsRef}
          onError={(m) => editor.setFeedback(m)}
          viewStorageKey={`salec:geo-boundaries-map-view:${tenantSlug}`}
        />

        <BoundaryDrawCanvas
          active={lassoDrawActive}
          strokeColor={editor.effectiveColor}
          containerRef={mapShellRef}
          controlsRef={controlsRef}
          onComplete={editor.applyLassoPolygon}
        />

        <VisitPlannerMapTools controlsRef={controlsRef} />

        <div className="vp-topbar vp-topbar-compact">
          <div className="vp-actions vp-actions-left">
            <Link href="/settings" className="vp-btn">
              Sozlamalar
            </Link>
            <Link href="/settings/territories" className="vp-btn">
              Territoriya
            </Link>
            <Link href="/settings/branches" className="vp-btn">
              Filiallar
            </Link>
            <Link href="/clients/visit-planner" className="vp-btn vp-primary">
              Vizitlar
            </Link>
          </div>
        </div>

        <div className="vp-filterbar vp-glass vp-filterbar-geo">
          <GeoBoundaryToolbar
            activeTab={editor.activeTab}
            onTabChange={editor.setActiveTab}
            layerLabels={editor.layerLabels}
            refId={editor.geoRefId}
            onRefIdChange={editor.setGeoRefId}
            tabItems={editor.itemsByLayer[editor.activeTab === "branch" ? "branch" : editor.activeTab] ?? []}
            selectedBoundary={editor.selectedBoundary}
            effectiveColor={editor.effectiveColor}
            customColor={editor.customColor}
            onCustomColorChange={editor.setCustomColor}
            drawActive={editor.drawActive}
            drawStyle={editor.drawStyle}
            onDrawStyleChange={editor.setDrawStyle}
            drawPointCount={editor.drawPointCount}
            saving={editor.saving}
            canManualDraw={editor.canManualDraw}
            usesAdminBoundary={editor.usesAdminBoundary}
            hasSavedPolygon={editor.hasSavedPolygon}
            hasAdminPolygon={editor.hasAdminPolygon}
            onStartDraw={editor.startDraw}
            onFinishDraw={() => void editor.finishDraw()}
            onCancelDraw={editor.cancelDraw}
            onUndoLastPoint={editor.undoLastPoint}
            onApplyAdminBoundary={() => void editor.applyAdminBoundary()}
            onDeleteBoundary={() => void editor.deleteBoundary()}
            onAssignClients={() => void editor.assignClients()}
            showZoneLinks={editor.activeTab === "zona"}
            warehouseId={editor.warehouseId}
            onWarehouseIdChange={editor.setWarehouseId}
            cashDeskId={editor.cashDeskId}
            onCashDeskIdChange={editor.setCashDeskId}
            warehouses={editor.warehouses}
            cashDesks={editor.cashDesks}
            onSaveZoneLinks={() => void editor.saveZoneLinks()}
          />
        </div>

        {editor.feedback ? <div className="vp-toast">{editor.feedback}</div> : null}
      </div>

      <GeoBoundaryOverlapModal
        open={Boolean(editor.pendingSave && editor.overlapConflicts && editor.overlapConflicts.length > 0)}
        incomingName={editor.pendingSave?.name ?? ""}
        conflicts={editor.overlapConflicts ?? []}
        saving={editor.saving}
        onChooseExistingWins={() => void editor.resolveOverlap("existing_wins")}
        onChooseIncomingWins={() => void editor.resolveOverlap("incoming_wins")}
        onCancel={editor.dismissOverlap}
      />
    </div>
  );
}
