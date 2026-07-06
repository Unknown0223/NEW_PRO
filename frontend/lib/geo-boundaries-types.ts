export type GeoBoundaryKind = "branch" | "zone" | "territory";

export type GeoBoundaryPoint = { lat: number; lng: number };

export type GeoBoundary = {
  id: string;
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
  polygon: GeoBoundaryPoint[];
  color?: string;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
  updated_at: string;
};

export type GeoBoundaryOverlapResolution = "existing_wins" | "incoming_wins";

export type GeoBoundaryOverlapConflict = {
  id: string;
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
};

export type GeoBoundaryUpsertBody = {
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
  polygon: GeoBoundaryPoint[];
  clip_against_existing?: boolean;
  overlap_resolution?: GeoBoundaryOverlapResolution;
  color?: string;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
};

export const GEO_BOUNDARY_KIND_LABELS: Record<GeoBoundaryKind, string> = {
  branch: "Филиал",
  zone: "Зона",
  territory: "Территория"
};

export const GEO_BOUNDARY_COLORS: Record<GeoBoundaryKind, string> = {
  branch: "#7c3aed",
  zone: "#0891b2",
  territory: "#16a34a"
};
