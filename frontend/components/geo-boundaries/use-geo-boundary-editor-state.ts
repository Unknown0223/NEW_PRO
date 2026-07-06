"use client";

import { useGeoBoundaries, getGeoBoundaryOverlapConflicts } from "@/hooks/use-geo-boundaries";
import { useVisitPlannerCatalog } from "@/hooks/use-visit-planner-catalog";
import type {
  GeoBoundary,
  GeoBoundaryKind,
  GeoBoundaryOverlapConflict,
  GeoBoundaryOverlapResolution,
  GeoBoundaryPoint
} from "@/lib/geo-boundaries-types";
import {
  type GeoBoundaryTab,
  TERRITORY_LAYER_COLORS,
  territoryLayerAllowsManualDraw,
  territoryLayerUsesAdminBoundary
} from "@/lib/geo-territory-layers";
import { pickUnusedBoundaryColor, resolveBoundaryColor } from "@/lib/geo-boundary-colors";
import { findGeoBoundaryOverlapConflicts } from "@/lib/geo-polygon";
import {
  adminRegionForCatalogName,
  adminRegionPrimaryRing,
  boundsCenterForAdminTokens,
  buildAdminRegionMapPolygons,
  loadUzAdminRegions,
  type UzAdminRegion
} from "@/lib/uz-admin-regions";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

type WarehouseOpt = { id: number; name: string; code?: string | null };
type CashDeskOpt = { id: number; name: string; code?: string | null };

export type GeoBoundaryMapPolygon = {
  id: string;
  coords: [number, number][];
  color: string;
  kind: GeoBoundaryKind;
  active: boolean;
  pulse?: boolean;
};

type PendingSave = {
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
  polygon: GeoBoundaryPoint[];
  color?: string;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
};

export type BoundaryDrawStyle = "lasso" | "click";

export function useGeoBoundaryEditorState(tenantSlug: string | null) {
  const { itemsByLayer, layerLabels } = useVisitPlannerCatalog(tenantSlug);
  const { q: boundariesQ, upsertMut, deleteMut, assignMut } = useGeoBoundaries(tenantSlug);

  const [activeTab, setActiveTab] = useState<GeoBoundaryTab>("branch");
  const [geoRefId, setGeoRefId] = useState("");
  const [customColor, setCustomColor] = useState<string>("");
  const [drawActive, setDrawActive] = useState(false);
  const [drawStyle, setDrawStyle] = useState<BoundaryDrawStyle>("lasso");
  const [drawPoints, setDrawPoints] = useState<GeoBoundaryPoint[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [overlapConflicts, setOverlapConflicts] = useState<GeoBoundaryOverlapConflict[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [pulseBoundaryId, setPulseBoundaryId] = useState<string | null>(null);
  const [adminRegions, setAdminRegions] = useState<UzAdminRegion[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [cashDeskId, setCashDeskId] = useState("");

  const warehousesQ = useQuery({
    queryKey: ["warehouses", tenantSlug, "geo-boundaries"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: WarehouseOpt[] }>(
        `/api/${tenantSlug}/warehouses/table?is_active=true&page=1&limit=200`
      );
      return (Array.isArray(data) ? data : data.data ?? []) as WarehouseOpt[];
    }
  });

  const cashDesksQ = useQuery({
    queryKey: ["cash-desks", tenantSlug, "geo-boundaries"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: CashDeskOpt[] }>(
        `/api/${tenantSlug}/cash-desks?is_active=true&limit=200&page=1`
      );
      return (Array.isArray(data) ? data : data.data ?? []) as CashDeskOpt[];
    }
  });

  useEffect(() => {
    let cancelled = false;
    loadUzAdminRegions()
      .then((list) => {
        if (!cancelled) setAdminRegions(list);
      })
      .catch(() => {
        if (!cancelled) setAdminRegions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const boundaries = boundariesQ.data ?? [];
  const tabItems = itemsByLayer[activeTab === "branch" ? "branch" : activeTab] ?? [];

  const selectedCatalogItem = useMemo(
    () => tabItems.find((i) => i.ref_id === geoRefId) ?? null,
    [tabItems, geoRefId]
  );

  const geoKind: GeoBoundaryKind = selectedCatalogItem?.kind ?? (activeTab === "branch" ? "branch" : activeTab === "zona" ? "zone" : "territory");

  const selectedBoundary = useMemo(() => {
    if (!geoRefId) return null;
    return boundaries.find((b) => b.kind === geoKind && b.ref_id === geoRefId) ?? null;
  }, [boundaries, geoKind, geoRefId]);

  const adminRegion = useMemo(() => {
    if (!selectedCatalogItem?.layer || !territoryLayerUsesAdminBoundary(selectedCatalogItem.layer)) {
      return null;
    }
    return adminRegionForCatalogName(
      selectedCatalogItem.name,
      selectedCatalogItem.layer,
      selectedCatalogItem.parentRegionName,
      adminRegions
    );
  }, [selectedCatalogItem, adminRegions]);

  const canManualDraw = territoryLayerAllowsManualDraw(activeTab);
  const usesAdminBoundary = Boolean(selectedCatalogItem?.layer && territoryLayerUsesAdminBoundary(selectedCatalogItem.layer));

  const effectiveColor = useMemo(() => {
    if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) return customColor.toLowerCase();
    if (selectedBoundary?.color && /^#[0-9a-fA-F]{6}$/.test(selectedBoundary.color)) {
      return selectedBoundary.color.toLowerCase();
    }
    if (selectedCatalogItem?.layer && TERRITORY_LAYER_COLORS[selectedCatalogItem.layer]) {
      return TERRITORY_LAYER_COLORS[selectedCatalogItem.layer];
    }
    return pickUnusedBoundaryColor(boundaries);
  }, [customColor, boundaries, selectedBoundary?.color, selectedCatalogItem?.layer]);

  const draftPulse = drawPoints.length >= 3;

  const mapPolygons: GeoBoundaryMapPolygon[] = useMemo(() => {
    const polys: GeoBoundaryMapPolygon[] = [];

    for (const b of boundaries) {
      if (b.polygon.length < 3) continue;
      const idx = boundaries.findIndex((x) => x.id === b.id);
      polys.push({
        id: b.id,
        coords: b.polygon.map((p) => [p.lat, p.lng] as [number, number]),
        color: resolveBoundaryColor(b, idx, boundaries),
        kind: b.kind,
        active: b.kind === geoKind && b.ref_id === geoRefId,
        pulse: b.id === pulseBoundaryId
      });
    }

    if (usesAdminBoundary && adminRegion && geoRefId) {
      const layerColor =
        selectedCatalogItem?.layer && TERRITORY_LAYER_COLORS[selectedCatalogItem.layer]
          ? TERRITORY_LAYER_COLORS[selectedCatalogItem.layer]
          : effectiveColor;
      const adminPolys = buildAdminRegionMapPolygons(adminRegions, [selectedCatalogItem!.name]);
      for (const p of adminPolys) {
        if (!p.active) continue;
        polys.push({
          id: `admin-${adminRegion.id}-${p.id}`,
          coords: p.coords,
          color: layerColor,
          kind: geoKind,
          active: true,
          pulse: !selectedBoundary
        });
      }
    }

    return polys;
  }, [
    boundaries,
    geoKind,
    geoRefId,
    pulseBoundaryId,
    usesAdminBoundary,
    adminRegion,
    adminRegions,
    selectedCatalogItem,
    effectiveColor,
    selectedBoundary
  ]);

  const draftCoords = useMemo(
    () => (drawPoints.length >= 2 ? drawPoints.map((p) => [p.lat, p.lng] as [number, number]) : null),
    [drawPoints]
  );

  const hasSavedPolygon = Boolean(selectedBoundary && selectedBoundary.polygon.length >= 3);
  const hasAdminPolygon = Boolean(adminRegion && adminRegion.rings.length > 0);
  const hasAnyPolygon = hasSavedPolygon || (usesAdminBoundary && hasAdminPolygon);

  const startDraw = useCallback(() => {
    if (!canManualDraw) {
      setFeedback("Oblast va Gorod — davlat chegarasi. Faqat Zona va Filial qo‘lda chiziladi.");
      return;
    }
    if (!geoRefId) {
      setFeedback("Avval ro‘yxatdan tanlang.");
      return;
    }
    setDrawPoints([]);
    setDrawActive(true);
    setFeedback(
      drawStyle === "lasso"
        ? "Kursor bilan chizing — qo‘yib yuboring."
        : "Xaritada kamida 3 nuqta bosing."
    );
  }, [geoRefId, drawStyle, canManualDraw]);

  const cancelDraw = useCallback(() => {
    setDrawActive(false);
    setDrawPoints([]);
  }, []);

  const addDrawPoint = useCallback((lat: number, lng: number) => {
    setDrawPoints((prev) => [...prev, { lat, lng }]);
  }, []);

  const applyLassoPolygon = useCallback((points: GeoBoundaryPoint[]) => {
    setDrawPoints(points);
    setFeedback(`${points.length} nuqtali chegara tayyor. «Saqlash» tugmasini bosing.`);
  }, []);

  const undoLastPoint = useCallback(() => {
    setDrawPoints((prev) => (prev.length ? prev.slice(0, -1) : prev));
  }, []);

  const savePolygon = useCallback(
    async (body: PendingSave, resolution?: GeoBoundaryOverlapResolution) => {
      const res = await upsertMut.mutateAsync({
        kind: body.kind,
        ref_id: body.ref_id,
        name: body.name,
        polygon: body.polygon,
        clip_against_existing: false,
        ...(resolution ? { overlap_resolution: resolution } : {}),
        ...(body.color ? { color: body.color } : {}),
        ...(body.kind === "zone"
          ? {
              warehouse_id: body.warehouse_id ?? null,
              cash_desk_id: body.cash_desk_id ?? null
            }
          : {})
      });
      setDrawActive(false);
      setDrawPoints([]);
      setPendingSave(null);
      setOverlapConflicts(null);
      setPulseBoundaryId(res.boundary.id);
      const clipNote = res.clipped ? " Kesilgan qism saqlandi." : "";
      setFeedback(`Hudud saqlandi. ${res.clients_assigned} ta klient bog‘landi.${clipNote}`);
    },
    [upsertMut]
  );

  const finishDraw = useCallback(async () => {
    if (!tenantSlug || !geoRefId || !selectedCatalogItem || drawPoints.length < 3) return;
    const body: PendingSave = {
      kind: geoKind,
      ref_id: geoRefId,
      name: selectedCatalogItem.name,
      polygon: drawPoints,
      color: effectiveColor,
      ...(geoKind === "zone"
        ? {
            warehouse_id: warehouseId ? parseInt(warehouseId, 10) : null,
            cash_desk_id: cashDeskId ? parseInt(cashDeskId, 10) : null
          }
        : {})
    };

    const localConflicts = findGeoBoundaryOverlapConflicts(drawPoints, boundaries, geoKind, geoRefId);
    if (localConflicts.length > 0) {
      setPendingSave(body);
      setOverlapConflicts(localConflicts);
      return;
    }

    try {
      await savePolygon(body);
    } catch (e) {
      const apiConflicts = getGeoBoundaryOverlapConflicts(e);
      if (apiConflicts?.length) {
        setPendingSave(body);
        setOverlapConflicts(apiConflicts);
        return;
      }
      setFeedback(getUserFacingError(e, "Saqlab bo‘lmadi."));
    }
  }, [
    tenantSlug,
    geoRefId,
    selectedCatalogItem,
    drawPoints,
    geoKind,
    effectiveColor,
    boundaries,
    savePolygon,
    warehouseId,
    cashDeskId
  ]);

  const applyAdminBoundary = useCallback(async () => {
    if (!tenantSlug || !geoRefId || !selectedCatalogItem || !adminRegion) {
      setFeedback("Davlat chegarasi topilmadi.");
      return;
    }
    const polygon = adminRegionPrimaryRing(adminRegion);
    if (polygon.length < 3) {
      setFeedback("Chegara nuqtalari yetarli emas.");
      return;
    }
    const body: PendingSave = {
      kind: geoKind,
      ref_id: geoRefId,
      name: selectedCatalogItem.name,
      polygon,
      color: effectiveColor,
      ...(geoKind === "zone"
        ? {
            warehouse_id: warehouseId ? parseInt(warehouseId, 10) : null,
            cash_desk_id: cashDeskId ? parseInt(cashDeskId, 10) : null
          }
        : {})
    };
    try {
      await savePolygon(body);
    } catch (e) {
      setFeedback(getUserFacingError(e, "Davlat chegarasini saqlab bo‘lmadi."));
    }
  }, [tenantSlug, geoRefId, selectedCatalogItem, adminRegion, geoKind, effectiveColor, savePolygon, warehouseId, cashDeskId]);

  const saveZoneLinks = useCallback(async () => {
    if (!selectedBoundary || selectedBoundary.kind !== "zone" || selectedBoundary.polygon.length < 3) return;
    const body: PendingSave = {
      kind: selectedBoundary.kind,
      ref_id: selectedBoundary.ref_id,
      name: selectedBoundary.name,
      polygon: selectedBoundary.polygon,
      color: selectedBoundary.color,
      warehouse_id: warehouseId ? parseInt(warehouseId, 10) : null,
      cash_desk_id: cashDeskId ? parseInt(cashDeskId, 10) : null
    };
    try {
      await savePolygon(body);
      setFeedback("Sklad va kassa bog‘landi.");
    } catch (e) {
      setFeedback(getUserFacingError(e, "Bog‘lab bo‘lmadi."));
    }
  }, [selectedBoundary, warehouseId, cashDeskId, savePolygon]);

  const resolveOverlap = useCallback(
    async (resolution: GeoBoundaryOverlapResolution) => {
      if (!pendingSave) return;
      try {
        await savePolygon(pendingSave, resolution);
      } catch (e) {
        setFeedback(getUserFacingError(e, "Saqlab bo‘lmadi."));
      }
    },
    [pendingSave, savePolygon]
  );

  const dismissOverlap = useCallback(() => {
    setOverlapConflicts(null);
    setPendingSave(null);
  }, []);

  const deleteBoundary = useCallback(async () => {
    if (!selectedBoundary) return;
    try {
      await deleteMut.mutateAsync(selectedBoundary.id);
      setFeedback("Hudud o‘chirildi.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "O‘chirib bo‘lmadi.");
    }
  }, [selectedBoundary, deleteMut]);

  const assignClients = useCallback(async () => {
    if (!selectedBoundary) return;
    try {
      const res = await assignMut.mutateAsync(selectedBoundary.id);
      setFeedback(`${res.updated} ta klient qayta bog‘landi.`);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Bog‘lab bo‘lmadi.");
    }
  }, [selectedBoundary, assignMut]);

  useEffect(() => {
    if (!pulseBoundaryId) return;
    const t = window.setTimeout(() => setPulseBoundaryId(null), 14_000);
    return () => window.clearTimeout(t);
  }, [pulseBoundaryId]);

  const onRefIdChange = useCallback(
    (id: string) => {
      setGeoRefId(id);
      setDrawActive(false);
      setDrawPoints([]);
      const item = tabItems.find((x) => x.ref_id === id);
      const kind = item?.kind ?? geoKind;
      const b = boundaries.find((x) => x.kind === kind && x.ref_id === id);
      setCustomColor(b?.color ?? "");
      setWarehouseId(b?.warehouse_id != null ? String(b.warehouse_id) : "");
      setCashDeskId(b?.cash_desk_id != null ? String(b.cash_desk_id) : "");
    },
    [boundaries, geoKind, tabItems]
  );

  const onTabChange = useCallback((tab: GeoBoundaryTab) => {
    setActiveTab(tab);
    setGeoRefId("");
    setCustomColor("");
    setWarehouseId("");
    setCashDeskId("");
    setDrawActive(false);
    setDrawPoints([]);
  }, []);

  const mapFocusCenter = useMemo(() => {
    if (usesAdminBoundary && selectedCatalogItem) {
      return boundsCenterForAdminTokens([selectedCatalogItem.name], adminRegions);
    }
    if (selectedBoundary && selectedBoundary.polygon.length >= 3) {
      const lat = selectedBoundary.polygon.reduce((a, p) => a + p.lat, 0) / selectedBoundary.polygon.length;
      const lng = selectedBoundary.polygon.reduce((a, p) => a + p.lng, 0) / selectedBoundary.polygon.length;
      return { lat, lng };
    }
    return null;
  }, [usesAdminBoundary, selectedCatalogItem, adminRegions, selectedBoundary]);

  return {
    activeTab,
    setActiveTab: onTabChange,
    layerLabels,
    itemsByLayer,
    geoKind,
    geoRefId,
    setGeoRefId: onRefIdChange,
    itemsByKind: {
      branch: itemsByLayer.branch,
      zone: itemsByLayer.zona,
      territory: [...itemsByLayer.oblast, ...itemsByLayer.gorod]
    },
    selectedBoundary,
    selectedCatalogItem,
    effectiveColor,
    customColor,
    setCustomColor,
    drawActive,
    drawStyle,
    setDrawStyle,
    drawPointCount: drawPoints.length,
    mapPolygons,
    draftCoords,
    draftPulse,
    feedback,
    setFeedback,
    startDraw,
    cancelDraw,
    addDrawPoint,
    applyLassoPolygon,
    undoLastPoint,
    finishDraw,
    applyAdminBoundary,
    deleteBoundary,
    assignClients,
    overlapConflicts,
    pendingSave,
    resolveOverlap,
    dismissOverlap,
    saving: upsertMut.isPending || deleteMut.isPending || assignMut.isPending,
    boundariesLoading: boundariesQ.isLoading,
    boundaries,
    canManualDraw,
    usesAdminBoundary,
    hasAnyPolygon,
    hasSavedPolygon,
    hasAdminPolygon,
    mapFocusCenter,
    warehouseId,
    setWarehouseId,
    cashDeskId,
    setCashDeskId,
    warehouses: warehousesQ.data ?? [],
    cashDesks: cashDesksQ.data ?? [],
    saveZoneLinks
  };
}

export type { GeoBoundary };
