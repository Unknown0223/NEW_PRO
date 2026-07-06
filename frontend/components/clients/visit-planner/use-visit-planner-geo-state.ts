"use client";

import { useGeoBoundaries } from "@/hooks/use-geo-boundaries";
import { useVisitPlannerCatalog } from "@/hooks/use-visit-planner-catalog";
import type { GeoBoundary, GeoBoundaryKind, GeoBoundaryPoint } from "@/lib/geo-boundaries-types";
import { geoBoundaryColor } from "@/lib/geo-boundary-colors";
import { clientInPolygon } from "@/lib/geo-polygon";
import { clientsMatchingCatalogItem } from "@/lib/visit-planner-geo-filter";
import type { ClientRow } from "@/lib/client-types";
import { getUserFacingError } from "@/lib/error-utils";
import { useCallback, useMemo, useState } from "react";

export type VisitPlannerGeoPolygon = {
  id: string;
  coords: [number, number][];
  color: string;
  kind: GeoBoundaryKind;
  active: boolean;
};

export function useVisitPlannerGeoState(tenantSlug: string | null, clientsWithGps: ClientRow[]) {
  const { itemsByKind } = useVisitPlannerCatalog(tenantSlug);
  const { q: boundariesQ, upsertMut, deleteMut, assignMut } = useGeoBoundaries(tenantSlug);

  const [geoKind, setGeoKind] = useState<GeoBoundaryKind>("branch");
  const [geoRefId, setGeoRefId] = useState("");
  const [drawActive, setDrawActive] = useState(false);
  const [drawPoints, setDrawPoints] = useState<GeoBoundaryPoint[]>([]);
  const [geoFeedback, setGeoFeedback] = useState<string | null>(null);

  const boundaries = boundariesQ.data ?? [];

  const selectedBoundary = useMemo(() => {
    if (!geoRefId) return null;
    return boundaries.find((b) => b.kind === geoKind && b.ref_id === geoRefId) ?? null;
  }, [boundaries, geoKind, geoRefId]);

  const selectedCatalogItem = useMemo(() => {
    return (itemsByKind[geoKind] ?? []).find((i) => i.ref_id === geoRefId) ?? null;
  }, [itemsByKind, geoKind, geoRefId]);

  const mapPolygons: VisitPlannerGeoPolygon[] = useMemo(() => {
    return boundaries
      .filter((b) => b.polygon.length >= 3)
      .map((b, index) => ({
        id: b.id,
        coords: b.polygon.map((p) => [p.lat, p.lng] as [number, number]),
        color: geoBoundaryColor(index),
        kind: b.kind,
        active: b.kind === geoKind && b.ref_id === geoRefId
      }));
  }, [boundaries, geoKind, geoRefId]);

  const draftCoords = useMemo(
    () => (drawPoints.length >= 2 ? drawPoints.map((p) => [p.lat, p.lng] as [number, number]) : null),
    [drawPoints]
  );

  const geoFilteredClients = useMemo(() => {
    if (!geoRefId || !selectedCatalogItem) return [];
    const poly = selectedBoundary?.polygon;
    if (poly && poly.length >= 3) {
      return clientsWithGps.filter((c) => clientInPolygon(c.latitude, c.longitude, poly));
    }
    return clientsMatchingCatalogItem(clientsWithGps, selectedCatalogItem.name, geoKind);
  }, [clientsWithGps, geoRefId, selectedCatalogItem, selectedBoundary, geoKind]);

  const hasSavedPolygon = Boolean(selectedBoundary && selectedBoundary.polygon.length >= 3);
  const clientsFilterMode: "none" | "polygon" | "name" =
    !geoRefId ? "none" : hasSavedPolygon ? "polygon" : "name";

  const clientsInArea = geoFilteredClients.length;

  const startDraw = useCallback(() => {
    if (!geoRefId) {
      setGeoFeedback("Avval filial, zona yoki territoriyani tanlang.");
      return;
    }
    setDrawPoints([]);
    setDrawActive(true);
    setGeoFeedback("Xaritada chegarani chizing (kamida 3 nuqta).");
  }, [geoRefId]);

  const cancelDraw = useCallback(() => {
    setDrawActive(false);
    setDrawPoints([]);
  }, []);

  const addDrawPoint = useCallback((lat: number, lng: number) => {
    setDrawPoints((prev) => [...prev, { lat, lng }]);
  }, []);

  const finishDraw = useCallback(async () => {
    if (!tenantSlug || !geoRefId || !selectedCatalogItem || drawPoints.length < 3) return;
    try {
      const res = await upsertMut.mutateAsync({
        kind: geoKind,
        ref_id: geoRefId,
        name: selectedCatalogItem.name,
        polygon: drawPoints,
        clip_against_existing: true
      });
      setDrawActive(false);
      setDrawPoints([]);
      const clipNote = res.clipped ? " Kesilgan qism saqlandi (mavjud chegara saqlanadi)." : "";
      setGeoFeedback(
        `Hudud saqlandi. ${res.clients_assigned} ta klient bog‘landi.${clipNote}`
      );
    } catch (e) {
      setGeoFeedback(getUserFacingError(e, "Saqlab bo‘lmadi."));
    }
  }, [tenantSlug, geoRefId, selectedCatalogItem, drawPoints, geoKind, upsertMut]);

  const deleteBoundary = useCallback(async () => {
    if (!selectedBoundary) return;
    try {
      await deleteMut.mutateAsync(selectedBoundary.id);
      setGeoFeedback("Hudud o‘chirildi.");
    } catch (e) {
      setGeoFeedback(e instanceof Error ? e.message : "O‘chirib bo‘lmadi.");
    }
  }, [selectedBoundary, deleteMut]);

  const assignClients = useCallback(async () => {
    if (!selectedBoundary) return;
    try {
      const res = await assignMut.mutateAsync(selectedBoundary.id);
      setGeoFeedback(`${res.updated} ta klient qayta bog‘landi.`);
    } catch (e) {
      setGeoFeedback(e instanceof Error ? e.message : "Bog‘lab bo‘lmadi.");
    }
  }, [selectedBoundary, assignMut]);

  return {
    geoKind,
    setGeoKind,
    geoRefId,
    setGeoRefId,
    itemsByKind,
    selectedBoundary,
    drawActive,
    drawPoints,
    drawPointCount: drawPoints.length,
    mapPolygons,
    draftCoords,
    geoFilteredClients,
    clientsInArea,
    clientsFilterMode,
    hasSavedPolygon,
    geoFeedback,
    setGeoFeedback,
    startDraw,
    cancelDraw,
    addDrawPoint,
    finishDraw,
    deleteBoundary,
    assignClients,
    geoSaving: upsertMut.isPending || deleteMut.isPending || assignMut.isPending,
    boundariesLoading: boundariesQ.isLoading
  };
}
