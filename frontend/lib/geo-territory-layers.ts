import type { GeoBoundaryKind } from "@/lib/geo-boundaries-types";
import { branchTerritoryCityDepths } from "@/lib/territory-tree";

/** Sozlamalardagi hudud darajasi: Zona → Oblast → Gorod */
export type TerritoryLayer = "zona" | "oblast" | "gorod";

export const TERRITORY_LAYER_COLORS: Record<TerritoryLayer, string> = {
  zona: "#7c3aed",
  oblast: "#2563eb",
  gorod: "#16a34a"
};

export const DEFAULT_LAYER_LABELS: Record<TerritoryLayer, string> = {
  zona: "Zona",
  oblast: "Oblast",
  gorod: "Gorod"
};

/** Daraxt chuqurligi → qatlam (3 darajali Zona/Oblast/Gorod). */
export function depthToTerritoryLayer(depth: number, levelCount: number, treeDepth = 3): TerritoryLayer | null {
  const { territoryDepth, cityDepth } = branchTerritoryCityDepths(levelCount, treeDepth);
  if (levelCount >= 3) {
    if (depth === 0) return "zona";
    if (depth === territoryDepth) return "oblast";
    if (depth >= cityDepth) return "gorod";
    return null;
  }
  if (levelCount === 2) {
    if (depth === 0) return "oblast";
    if (depth >= 1) return "gorod";
  }
  if (levelCount === 1) {
    if (depth === 0) return "oblast";
  }
  return null;
}

export function territoryLayerUsesAdminBoundary(layer: TerritoryLayer): layer is "oblast" | "gorod" {
  return layer === "oblast" || layer === "gorod";
}

export function territoryLayerAllowsManualDraw(layer: TerritoryLayer | "branch"): boolean {
  return layer === "branch" || layer === "zona";
}

export function territoryLayerToApiKind(layer: TerritoryLayer): GeoBoundaryKind {
  return layer === "zona" ? "zone" : "territory";
}

export function resolveLayerLabels(levels: string[] | undefined): Record<TerritoryLayer, string> {
  const L = levels ?? [];
  if (L.length >= 3) {
    return {
      zona: L[0]?.trim() || DEFAULT_LAYER_LABELS.zona,
      oblast: L[1]?.trim() || DEFAULT_LAYER_LABELS.oblast,
      gorod: L[2]?.trim() || DEFAULT_LAYER_LABELS.gorod
    };
  }
  if (L.length === 2) {
    return {
      zona: DEFAULT_LAYER_LABELS.zona,
      oblast: L[0]?.trim() || DEFAULT_LAYER_LABELS.oblast,
      gorod: L[1]?.trim() || DEFAULT_LAYER_LABELS.gorod
    };
  }
  return { ...DEFAULT_LAYER_LABELS };
}

export type GeoBoundaryTab = "branch" | TerritoryLayer;

export const GEO_BOUNDARY_TABS: GeoBoundaryTab[] = ["branch", "zona", "oblast", "gorod"];
