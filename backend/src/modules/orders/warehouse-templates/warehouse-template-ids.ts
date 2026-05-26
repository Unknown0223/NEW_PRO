/** UI / API: «Загруз зав.склада» — 13 ta layout. */
export const WAREHOUSE_LAYOUT_IDS = [
  "wh-1.1",
  "wh-1.1.2",
  "wh-4.1",
  "wh-4.1.1",
  "wh-4.1.2",
  "wh-6.0",
  "wh-6.0.1",
  "wh-6.0.2",
  "wh-7.0.0",
  "wh-7.0.1",
  "wh-xprinter",
  "wh-7.0.3",
  "wh-7.0.4"
] as const;

export type WarehouseLayoutId = (typeof WAREHOUSE_LAYOUT_IDS)[number];

export type WarehouseLayoutFamily =
  | "catalog_dual_110"
  | "list_simple_112"
  | "ttn_grouped_410"
  | "matrix_agents_600"
  | "matrix_clients_601"
  | "summary_clients_602"
  | "summary_compact_700"
  | "per_expeditor_701"
  | "thermal_702"
  | "territory_matrix_703"
  | "category_client_704";

export type WarehouseLayoutDef = {
  id: WarehouseLayoutId;
  /** Lalaku fayl prefiksi: 110, 702, … */
  fileCode: string;
  label: string;
  versionLabel: string;
  assetFile: string;
  family: WarehouseLayoutFamily;
};

export const WAREHOUSE_LAYOUT_DEFS: WarehouseLayoutDef[] = [
  {
    id: "wh-1.1",
    fileCode: "110",
    label: "Загруз зав.склада 1.1",
    versionLabel: "1.1",
    assetFile: "110-wh-1.1.xlsx",
    family: "catalog_dual_110"
  },
  {
    id: "wh-1.1.2",
    fileCode: "112",
    label: "Загруз зав.склада 1.1.2",
    versionLabel: "1.1.2",
    assetFile: "112-wh-1.1.2.xlsx",
    family: "list_simple_112"
  },
  {
    id: "wh-4.1",
    fileCode: "410",
    label: "Загруз зав.склада 4.1",
    versionLabel: "4.1",
    assetFile: "410-wh-4.1.xlsx",
    family: "ttn_grouped_410"
  },
  {
    id: "wh-4.1.1",
    fileCode: "411",
    label: "Загруз зав.склада 4.1.1",
    versionLabel: "4.1.1",
    assetFile: "411-wh-4.1.1.xlsx",
    family: "ttn_grouped_410"
  },
  {
    id: "wh-4.1.2",
    fileCode: "412",
    label: "Загруз зав.склада 4.1.2",
    versionLabel: "4.1.2",
    assetFile: "412-wh-4.1.2.xlsx",
    family: "ttn_grouped_410"
  },
  {
    id: "wh-6.0",
    fileCode: "600",
    label: "Загруз зав.склада 6.0",
    versionLabel: "6.0",
    assetFile: "600-wh-6.0.xlsx",
    family: "matrix_agents_600"
  },
  {
    id: "wh-6.0.1",
    fileCode: "601",
    label: "Загруз зав.склада 6.0.1",
    versionLabel: "6.0.1",
    assetFile: "601-wh-6.0.1.xlsx",
    family: "matrix_clients_601"
  },
  {
    id: "wh-6.0.2",
    fileCode: "602",
    label: "Загруз зав.склада 6.0.2",
    versionLabel: "6.0.2",
    assetFile: "602-wh-6.0.2.xlsx",
    family: "summary_clients_602"
  },
  {
    id: "wh-7.0.0",
    fileCode: "700",
    label: "Загруз зав.склада 7.0.0",
    versionLabel: "7.0.0",
    assetFile: "700-wh-7.0.0.xlsx",
    family: "summary_compact_700"
  },
  {
    id: "wh-7.0.1",
    fileCode: "701",
    label: "Загруз зав.склада 7.0.1",
    versionLabel: "7.0.1",
    assetFile: "701-wh-7.0.1.xlsx",
    family: "per_expeditor_701"
  },
  {
    id: "wh-xprinter",
    fileCode: "702",
    label: "Загруз X-Printer 80мм",
    versionLabel: "80мм",
    assetFile: "702-wh-xprinter.xlsx",
    family: "thermal_702"
  },
  {
    id: "wh-7.0.3",
    fileCode: "703",
    label: "Загруз зав.склада 7.0.3",
    versionLabel: "7.0.3",
    assetFile: "703-wh-7.0.3.xlsx",
    family: "territory_matrix_703"
  },
  {
    id: "wh-7.0.4",
    fileCode: "704",
    label: "Загруз зав.склада 7.0.4",
    versionLabel: "7.0.4",
    assetFile: "704-wh-7.0.4.xlsx",
    family: "category_client_704"
  }
];

const BY_ID = new Map(WAREHOUSE_LAYOUT_DEFS.map((d) => [d.id, d]));

export function getWarehouseLayoutDef(id: WarehouseLayoutId): WarehouseLayoutDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error("INVALID_WAREHOUSE_LAYOUT");
  return d;
}

export function isWarehouseLayoutId(v: string): v is WarehouseLayoutId {
  return (WAREHOUSE_LAYOUT_IDS as readonly string[]).includes(v);
}

/** Lalaku: `110 Загруз зав.склада 1.1(26-05-2026).xlsx` */
export function warehouseLayoutDownloadFilename(id: WarehouseLayoutId, at = new Date()): string {
  const def = getWarehouseLayoutDef(id);
  const dd = String(at.getDate()).padStart(2, "0");
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const yyyy = at.getFullYear();
  const title =
    def.id === "wh-xprinter"
      ? `${def.fileCode} Загруз X-Printer 80мм`
      : `${def.fileCode} Загруз зав.склада ${def.versionLabel}`;
  return `${title}(${dd}-${mm}-${yyyy}).xlsx`;
}
