export type GeoBoundaryKind = "branch" | "zone" | "territory";

export type GeoBoundaryPoint = { lat: number; lng: number };

export type GeoBoundaryDto = {
  id: string;
  kind: GeoBoundaryKind;
  /** branch.id yoki territory_nodes.id */
  ref_id: string;
  name: string;
  polygon: GeoBoundaryPoint[];
  /** Ixtiyoriy rang (#RRGGBB). Bo‘sh bo‘lsa frontend palette dan oladi. */
  color?: string;
  /** Zona uchun bog‘langan sklad */
  warehouse_id?: number | null;
  /** Zona uchun bog‘langan kassa */
  cash_desk_id?: number | null;
  updated_at: string;
  deleted_at?: string | null;
};

export type GeoBoundaryOverlapResolution = "existing_wins" | "incoming_wins";

export type GeoBoundaryUpsertInput = {
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
  polygon: GeoBoundaryPoint[];
  /** true — mavjud hududlardan tashqariga qirqish (bir xil turda) */
  clip_against_existing?: boolean;
  /** Kesishda qaysi chegara ustun — modal tanlovi */
  overlap_resolution?: GeoBoundaryOverlapResolution;
  color?: string;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
};

export type GeoBoundaryOverlapConflict = {
  id: string;
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
};
