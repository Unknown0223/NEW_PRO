import { REGION_ZONE_ROWS, normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";

export function zoneForExcelRegion(regionRaw: string): string | null {
  const n = normKeyTerritoryMatch(regionRaw);
  if (!n) return null;
  for (const row of REGION_ZONE_ROWS) {
    if (normKeyTerritoryMatch(row.region) === n) return row.zone;
  }
  return null;
}

export type ExcelRegionCardPatch = {
  region: string;
  zone?: string;
};

/** Kartochkada viloyat bo‘sh bo‘lsa Excel «Область» ni yozamiz; mavjud qiymatni ustiga yozmaymiz. */
export function excelRegionCardPatch(input: {
  cardRegion: string | null | undefined;
  cardZone: string | null | undefined;
  excelRegion: string;
}): { patch: ExcelRegionCardPatch | null; mismatch: boolean } {
  const excelRegion = input.excelRegion.trim();
  if (!excelRegion) return { patch: null, mismatch: false };
  const card = (input.cardRegion ?? "").trim();
  if (card) {
    return { patch: null, mismatch: card.toLowerCase() !== excelRegion.toLowerCase() };
  }
  const patch: ExcelRegionCardPatch = { region: excelRegion };
  if (!(input.cardZone ?? "").trim()) {
    const z = zoneForExcelRegion(excelRegion);
    if (z) patch.zone = z;
  }
  return { patch, mismatch: false };
}
