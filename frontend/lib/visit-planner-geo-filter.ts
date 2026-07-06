import type { GeoBoundaryKind } from "./geo-boundaries-types";
import type { ClientRow } from "./client-types";

function foldTerritoryToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_.\-–—]+/g, "");
}

/** Hudud nomi va klient maydoni mos kelishini tekshiradi (Yunusobod ↔ TSH_YUNUSOBOD). */
export function territoryFieldMatches(field: string | null | undefined, catalogName: string): boolean {
  const f = foldTerritoryToken(field ?? "");
  const n = foldTerritoryToken(catalogName);
  if (!f || !n) return false;
  if (f === n) return true;
  return f.includes(n) || n.includes(f);
}

/** Chegara saqlanmaguncha — katalogdagi hudud nomi bo‘yicha klientlarni filtrlash. */
export function clientsMatchingCatalogItem(
  clients: ClientRow[],
  catalogName: string,
  _kind: GeoBoundaryKind
): ClientRow[] {
  const name = catalogName.trim();
  if (!name) return [];

  // Filial / zona / territoriya — klientda `city` (TSH_YUNUSOBOD), `zone`, `region` bo‘lishi mumkin.
  return clients.filter(
    (c) =>
      territoryFieldMatches(c.city, name) ||
      territoryFieldMatches(c.district, name) ||
      territoryFieldMatches(c.region, name) ||
      territoryFieldMatches(c.zone, name)
  );
}
