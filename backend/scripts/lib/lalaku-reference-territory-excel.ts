/**
 * Lalaku territoriya — Excel region/shahar merge.
 */
import {
  defaultRegionTerritoryCode,
  defaultZoneTerritoryCode,
  mergeTerritoryBundle,
  normKey,
  normKeyTerritoryMatch,
  type LalakuTerritoryNode
} from "../../../shared/territory-lalaku-seed";
import {
  canonicalRegionNameFromExcel,
  findTerritoryRegionNodesByNameKey,
  normalizeTerritoryLabel,
  parseTerritoryNodes,
  regionChildExistsUnderOtherRootZone,
  simpleHash36,
  slugId
} from "./lalaku-reference-territory";

type TerritoryNode = LalakuTerritoryNode;

/** Excel «Данные Город»: Имя, Код, Название региона */
export type CityXlsxRow = {
  order_num?: number | null;
  name: string;
  code: string;
  region: string;
};

export type MergeCitiesIntoTerritoryStats = {
  added: number;
  skipped_duplicate: number;
  skipped_bad_row: number;
  missing_regions: string[];
};

/** Excel «Данные Регион»: viloyat nomi + zona (ildiz) */
export type RegionXlsxRow = {
  order_num?: number | null;
  region: string;
  zone: string;
};

export type MergeRegionsIntoTerritoryStats = {
  added_zones: number;
  added_regions: number;
  skipped_duplicate_region: number;
  skipped_region_exists_elsewhere: number;
  skipped_bad_row: number;
};

export function mergeExcelRegionsIntoTerritoryForest(
  forest: TerritoryNode[],
  rows: RegionXlsxRow[]
): MergeRegionsIntoTerritoryStats {
  let added_zones = 0;
  let added_regions = 0;
  let skipped_duplicate_region = 0;
  let skipped_region_exists_elsewhere = 0;
  let skipped_bad_row = 0;

  const topByKey = new Map<string, TerritoryNode>();
  for (const n of forest) {
    topByKey.set(normKey(n.name), n);
  }

  const ensureZone = (zoneRaw: string): TerritoryNode => {
    const zt = zoneRaw.trim();
    const key = normKey(zt);
    let z = topByKey.get(key);
    if (!z) {
      const display = zt.toUpperCase() === zt.trim() ? zt.trim() : zt.trim().toUpperCase();
      z = {
        id: slugId("z", key),
        name: display,
        code: defaultZoneTerritoryCode(display),
        comment: null,
        sort_order: null,
        active: true,
        children: []
      };
      topByKey.set(key, z);
      forest.push(z);
      added_zones++;
    }
    return z;
  };

  for (const row of rows) {
    const zoneRaw = row.zone?.trim() ?? "";
    const regionRaw = row.region?.trim() ?? "";
    if (!zoneRaw || !regionRaw) {
      skipped_bad_row++;
      continue;
    }

    const zoneNode = ensureZone(zoneRaw);
    const canonicalRegion = canonicalRegionNameFromExcel(regionRaw);
    const rKey = normKeyTerritoryMatch(canonicalRegion);

    const dupReg = zoneNode.children.find((c) => normKeyTerritoryMatch(c.name) === rKey);
    if (dupReg) {
      if (!dupReg.code) {
        const dc = defaultRegionTerritoryCode(dupReg.name);
        if (dc) dupReg.code = dc;
      }
      skipped_duplicate_region++;
      continue;
    }
    if (regionChildExistsUnderOtherRootZone(forest, zoneNode, rKey)) {
      skipped_region_exists_elsewhere++;
      continue;
    }

    const sort_order =
      typeof row.order_num === "number" && Number.isInteger(row.order_num) ? row.order_num : null;

    zoneNode.children.push({
      id: slugId("r", `${normKey(zoneNode.name)}-${normKey(canonicalRegion)}`),
      name: canonicalRegion,
      code: defaultRegionTerritoryCode(canonicalRegion),
      comment: null,
      sort_order,
      active: true,
      children: []
    });
    added_regions++;
  }

  for (const n of forest) {
    sortTerritoryChildrenWhenMixedSortOrder(n);
  }

  return {
    added_zones,
    added_regions,
    skipped_duplicate_region,
    skipped_region_exists_elsewhere,
    skipped_bad_row
  };
}

/**
 * Mavjud daraxt + Lalaku + Excel viloyatlari + Excel shaharlari (bir ketma-ketlik).
 */
export function buildTerritoryForestWithRegionAndCityRows(
  existingTerritoryNodesUnknown: unknown,
  regionRows: RegionXlsxRow[],
  cityRows: CityXlsxRow[]
): {
  forest: TerritoryNode[];
  regionStats: MergeRegionsIntoTerritoryStats;
  cityStats: MergeCitiesIntoTerritoryStats;
} {
  const prev = parseTerritoryNodes(existingTerritoryNodesUnknown);
  const forest = mergeTerritoryBundle(prev);
  const regionStats = mergeExcelRegionsIntoTerritoryForest(forest, regionRows);
  const cityStats = mergeCitiesIntoTerritoryForest(forest, cityRows);
  return { forest, regionStats, cityStats };
}

/**
 * `mergeTerritoryBundle` dan keyin: har bir qatorni tegishli viloyat (region) tugunining `children`iga qo‘shadi.
 * Bir xil viloyat/kod yoki viloyat/shahar nomi bo‘lsa takrorlamaydi.
 */
export function mergeCitiesIntoTerritoryForest(
  forest: TerritoryNode[],
  rows: CityXlsxRow[]
): MergeCitiesIntoTerritoryStats {
  const missingRegions = new Set<string>();
  let added = 0;
  let skipped_duplicate = 0;
  let skipped_bad_row = 0;

  for (const row of rows) {
    const regionRaw = row.region?.trim() ?? "";
    const nameRaw = row.name?.trim() ?? "";
    const codeRaw = row.code?.trim() ?? "";
    if (!regionRaw || !nameRaw) {
      skipped_bad_row++;
      continue;
    }

    const canonicalRegion = canonicalRegionNameFromExcel(regionRaw);
    const rKey = normKeyTerritoryMatch(canonicalRegion);
    const cityDisplay = normalizeTerritoryLabel(nameRaw);
    const cKey = normKeyTerritoryMatch(cityDisplay);

    let code: string | null = null;
    const up = codeRaw.toUpperCase();
    if (up && /^[A-Z0-9_]+$/.test(up)) code = up.slice(0, 20);

    const targets = findTerritoryRegionNodesByNameKey(forest, canonicalRegion);
    if (targets.length === 0) {
      missingRegions.add(regionRaw);
      skipped_bad_row++;
      continue;
    }
    const regionNode = targets[0];

    const matchChild = regionNode.children.find((ch) => {
      if (code && ch.code && normKey(ch.code) === normKey(code)) return true;
      return normKeyTerritoryMatch(ch.name) === cKey;
    });
    if (matchChild) {
      if (code && (!matchChild.code || normKey(matchChild.code) !== normKey(code))) {
        matchChild.code = code;
      }
      skipped_duplicate++;
      continue;
    }

    const idKey = code ? `${rKey}-${code}` : `${rKey}-${cKey}-${simpleHash36(cityDisplay)}`;
    const id = slugId("city", idKey);
    const sort_order =
      typeof row.order_num === "number" && Number.isInteger(row.order_num) ? row.order_num : null;

    regionNode.children.push({
      id,
      name: cityDisplay,
      code,
      comment: null,
      sort_order,
      active: true,
      children: []
    });
    added++;
  }

  for (const n of forest) {
    sortTerritoryChildrenWhenMixedSortOrder(n);
  }

  return {
    added,
    skipped_duplicate,
    skipped_bad_row,
    missing_regions: [...missingRegions].sort((a, b) => a.localeCompare(b, "uz"))
  };
}

/** Zona/viloyat tartibini saqlab, faqat kamida bitta `sort_order` bo‘lsa farzandlarni tartiblaydi. */
function sortTerritoryChildrenWhenMixedSortOrder(node: TerritoryNode): void {
  for (const c of node.children) sortTerritoryChildrenWhenMixedSortOrder(c);
  if (!node.children.length) return;
  const anyOrder = node.children.some((c) => c.sort_order != null);
  if (!anyOrder) return;
  node.children.sort((a, b) => {
    const ao = a.sort_order;
    const bo = b.sort_order;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return normKey(a.name).localeCompare(normKey(b.name), "uz");
  });
}

/**
 * Mavjud `territory_nodes` + Lalaku zona/viloyatlar + Excel shaharlari.
 */
export function buildTerritoryForestWithCitiesFromRows(
  existingTerritoryNodesUnknown: unknown,
  cityRows: CityXlsxRow[]
): {
  forest: TerritoryNode[];
  stats: MergeCitiesIntoTerritoryStats;
} {
  const prev = parseTerritoryNodes(existingTerritoryNodesUnknown);
  const forest = mergeTerritoryBundle(prev);
  const stats = mergeCitiesIntoTerritoryForest(forest, cityRows);
  return { forest, stats };
}
