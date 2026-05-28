/** UI «Загруз экспедитор» — backend `expeditor_loading_layout`. */
export const EXPEDITOR_LOADING_LAYOUT_IDS = [
  "ex-2.0",
  "ex-3.0",
  "ex-4.0.1",
  "ex-5.1.1",
  "ex-5.1.2",
  "ex-5.1.3",
  "ex-5.1.4",
  "ex-5.1.5",
  "ex-5.1.6",
  "ex-5.1.7",
  "ex-5.1.8",
  "ex-5.1.9",
  "ex-5.2.0"
] as const;

export type ExpeditorLoadingLayoutId = (typeof EXPEDITOR_LOADING_LAYOUT_IDS)[number];

export type ExpeditorLoadingLayoutDef = {
  id: ExpeditorLoadingLayoutId;
  label: string;
  versionLabel: string;
  /** Yuklab olish nomi prefiksi: `518 Загруз …` (5.2.0 da yo‘q) */
  filePrefix?: string;
  /** `backend/assets/nakladnoy/loading/` */
  assetFile: string;
};

export const EXPEDITOR_LOADING_DEFS: ExpeditorLoadingLayoutDef[] = [
  { id: "ex-2.0", label: "Загруз зав.склада 2.0", versionLabel: "2.0", filePrefix: "200", assetFile: "200-zagruz-2.0.xlsx" },
  { id: "ex-3.0", label: "Загруз зав.склада 3.0", versionLabel: "3.0", filePrefix: "300", assetFile: "300-zagruz-3.0.xlsx" },
  { id: "ex-4.0.1", label: "Загруз зав.склада 4.0.1", versionLabel: "4.0.1", filePrefix: "401", assetFile: "401-zagruz-4.0.1.xlsx" },
  { id: "ex-5.1.1", label: "Загруз зав.склада 5.1.1", versionLabel: "5.1.1", filePrefix: "511", assetFile: "511-zagruz-5.1.1.xlsx" },
  { id: "ex-5.1.2", label: "Загруз зав.склада 5.1.2", versionLabel: "5.1.2", filePrefix: "512", assetFile: "512-zagruz-5.1.2.xlsx" },
  { id: "ex-5.1.3", label: "Загруз зав.склада 5.1.3", versionLabel: "5.1.3", filePrefix: "513", assetFile: "513-zagruz-5.1.3.xlsx" },
  { id: "ex-5.1.4", label: "Загруз зав.склада 5.1.4", versionLabel: "5.1.4", filePrefix: "514", assetFile: "514-zagruz-5.1.4.xlsx" },
  { id: "ex-5.1.5", label: "Загруз зав.склада 5.1.5", versionLabel: "5.1.5", filePrefix: "515", assetFile: "515-zagruz-5.1.5.xlsx" },
  { id: "ex-5.1.6", label: "Загруз зав.склада 5.1.6", versionLabel: "5.1.6", filePrefix: "516", assetFile: "516-zagruz-5.1.6.xlsx" },
  { id: "ex-5.1.7", label: "Загруз зав.склада 5.1.7", versionLabel: "5.1.7", filePrefix: "517", assetFile: "517-zagruz-5.1.7.xlsx" },
  { id: "ex-5.1.8", label: "Загруз зав.склада 5.1.8", versionLabel: "5.1.8", filePrefix: "518", assetFile: "518-zagruz-5.1.8.xlsx" },
  { id: "ex-5.1.9", label: "Загруз зав.склада 5.1.9", versionLabel: "5.1.9", filePrefix: "519", assetFile: "519-zagruz-5.1.9.xlsx" },
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

/** `512 Загруз зав.склада 5.1.2(27-05-2026).xlsx` yoki `Загруз зав.склада 5.2.0(…)` */
export function expeditorLoadingDownloadFilename(id: ExpeditorLoadingLayoutId, at = new Date()): string {
  const def = getExpeditorLoadingLayoutDef(id);
  const dd = String(at.getDate()).padStart(2, "0");
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  const yyyy = at.getFullYear();
  const base = `Загруз зав.склада ${def.versionLabel}(${dd}-${mm}-${yyyy}).xlsx`;
  return def.filePrefix ? `${def.filePrefix} ${base}` : base;
}
