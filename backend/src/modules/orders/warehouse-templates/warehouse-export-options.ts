/** «Загруз зав.склада» — 112 / 410 / 600 shablon sozlamalari (frontend bilan mos). */
export type WarehouseExportOptions = {
  /** 1.1.2 — mahsulotlarni nom bo‘yicha saralash */
  sortProducts?: boolean;
  /** 4.1 — shablon qatoriga shtrix-kod */
  showBarcode?: boolean;
  /** 4.1 — shablon qatoriga SKU */
  showSku?: boolean;
  /** 6.0 — meta qatorlar */
  showLoadDate?: boolean;
  showAgents?: boolean;
  showTerritory?: boolean;
  showExpeditor?: boolean;
  showAgentPhone?: boolean;
  /** 6.0 — faqat zakazdagi mahsulotlar (aks holda shablondagi barcha qatorlar) */
  productsByOrderOnly?: boolean;
  showProductId?: boolean;
  showProductCode?: boolean;
  showProductPrice?: boolean;
};

export const DEFAULT_WAREHOUSE_EXPORT_OPTIONS: WarehouseExportOptions = {
  sortProducts: true,
  showBarcode: true,
  showSku: true,
  showLoadDate: true,
  showAgents: true,
  showTerritory: true,
  showExpeditor: true,
  showAgentPhone: true,
  productsByOrderOnly: true,
  showProductId: true,
  showProductCode: true,
  showProductPrice: true
};

const SNAKE_TO_CAMEL: Record<string, keyof WarehouseExportOptions> = {
  sort_products: "sortProducts",
  show_barcode: "showBarcode",
  show_sku: "showSku",
  show_load_date: "showLoadDate",
  show_agents: "showAgents",
  show_territory: "showTerritory",
  show_expeditor: "showExpeditor",
  show_agent_phone: "showAgentPhone",
  products_by_order_only: "productsByOrderOnly",
  show_product_id: "showProductId",
  show_product_code: "showProductCode",
  show_product_price: "showProductPrice"
};

function pickExportBool(
  o: Record<string, unknown>,
  camel: keyof WarehouseExportOptions,
  fallback: boolean | undefined
): boolean | undefined {
  const snake = Object.entries(SNAKE_TO_CAMEL).find(([, c]) => c === camel)?.[0];
  if (snake && o[snake] !== undefined) return o[snake] === true;
  if (o[camel] !== undefined) return o[camel] === true;
  return fallback;
}

export function normalizeWarehouseExportOptions(raw: unknown): WarehouseExportOptions {
  const d = DEFAULT_WAREHOUSE_EXPORT_OPTIONS;
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof WarehouseExportOptions) =>
    pickExportBool(o, k, d[k]) ?? d[k];
  return {
    sortProducts: pick("sortProducts"),
    showBarcode: pick("showBarcode"),
    showSku: pick("showSku"),
    showLoadDate: pick("showLoadDate"),
    showAgents: pick("showAgents"),
    showTerritory: pick("showTerritory"),
    showExpeditor: pick("showExpeditor"),
    showAgentPhone: pick("showAgentPhone"),
    productsByOrderOnly: pick("productsByOrderOnly"),
    showProductId: pick("showProductId"),
    showProductCode: pick("showProductCode"),
    showProductPrice: pick("showProductPrice")
  };
}

export function warehouseExportOptionsForLayout(
  layoutId: string,
  raw: unknown
): WarehouseExportOptions | undefined {
  if (layoutId === "wh-1.1.2") {
    const o = normalizeWarehouseExportOptions(raw);
    return { sortProducts: o.sortProducts };
  }
  if (layoutId === "wh-4.1") {
    const o = normalizeWarehouseExportOptions(raw);
    return { showBarcode: o.showBarcode, showSku: o.showSku };
  }
  if (layoutId === "wh-6.0") {
    const o = normalizeWarehouseExportOptions(raw);
    return {
      showLoadDate: o.showLoadDate,
      showAgents: o.showAgents,
      showTerritory: o.showTerritory,
      showExpeditor: o.showExpeditor,
      showAgentPhone: o.showAgentPhone,
      productsByOrderOnly: o.productsByOrderOnly,
      showProductId: o.showProductId,
      showProductCode: o.showProductCode,
      showProductPrice: o.showProductPrice
    };
  }
  return undefined;
}
