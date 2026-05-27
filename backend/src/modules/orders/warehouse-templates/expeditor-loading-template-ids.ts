/** UI «Загруз экспедитор» — backend `expeditor_loading_layout`. */
export const EXPEDITOR_LOADING_LAYOUT_IDS = [
  "ex-3.0",
  "ex-4.0.1",
  "ex-4.1.0",
  "ex-5.0",
  "ex-5.0.6",
  "ex-5.1.0",
  "ex-5.1.0.1",
  "ex-5.1.6",
  "ex-5.1.8",
  "ex-5.2.0"
] as const;

export type ExpeditorLoadingLayoutId = (typeof EXPEDITOR_LOADING_LAYOUT_IDS)[number];

export type ExpeditorLoadingLayoutDef = {
  id: ExpeditorLoadingLayoutId;
  label: string;
  versionLabel: string;
  /** `backend/assets/nakladnoy/loading/` */
  assetFile: string;
};

/** Barcha versiyalar tayyor 518 shablon strukturasidan (5.1.8 andoza). */
export const EXPEDITOR_LOADING_DEFS: ExpeditorLoadingLayoutDef[] = [
  { id: "ex-3.0", label: "Загруз зав.склада 3.0", versionLabel: "3.0", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-4.0.1", label: "Загруз зав.склада 4.0.1", versionLabel: "4.0.1", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-4.1.0", label: "Загруз зав.склада 4.1.0", versionLabel: "4.1.0", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.0", label: "Загруз зав.склада 5.0", versionLabel: "5.0", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.0.6", label: "Загруз зав.склада 5.0.6", versionLabel: "5.0.6", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.1.0", label: "Загруз зав.склада 5.1.0", versionLabel: "5.1.0", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.1.0.1", label: "Загруз зав.склада 5.1.0.1", versionLabel: "5.1.0.1", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.1.6", label: "Загруз зав.склада 5.1.6", versionLabel: "5.1.6", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.1.8", label: "Загруз зав.склада 5.1.8", versionLabel: "5.1.8", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.2.0", label: "Загруз зав.склада 5.2.0", versionLabel: "5.2.0", assetFile: "520-zagruz-5.2.0.xlsx" }
];

const BY_ID = new Map(EXPEDITOR_LOADING_DEFS.map((d) => [d.id, d]));

export function getExpeditorLoadingLayoutDef(id: ExpeditorLoadingLayoutId): ExpeditorLoadingLayoutDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error("INVALID_EXPEDITOR_LOADING_LAYOUT");
  return d;
}

export function isExpeditorLoadingLayoutId(v: string): v is ExpeditorLoadingLayoutId {
  return (EXPEDITOR_LOADING_LAYOUT_IDS as readonly string[]).includes(v);
}

/** Lalaku: `Загруз зав.склада 5.2.0(26-05-2026).xlsx` yoki `518 … 5.1.8(…)` */
export function expeditorLoadingDownloadFilename(id: ExpeditorLoadingLayoutId, at = new Date()): string {
  const def = getExpeditorLoadingLayoutDef(id);
  const dd = String(at.getDate()).padStart(2, "0");
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const yyyy = at.getFullYear();
  if (id === "ex-5.2.0") {
    return `Загруз зав.склада ${def.versionLabel}(${dd}-${mm}-${yyyy}).xlsx`;
  }
  return `518 Загруз зав.склада ${def.versionLabel}(${dd}-${mm}-${yyyy}).xlsx`;
}
