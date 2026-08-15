import { SALES_DATA, generateSalesData } from "./data/salesData";
import { DEFAULT_DEMO_CONFIG, SALES_FIELDS } from "./data/salesFields";
import { PivotApp, withHeatmapPresets } from "@salec/pivot-ui";
import { readPivotConfigFromUrl } from "./hooks/usePivotUrlConfig";
import "./index.css";

const URL_CONFIG = readPivotConfigFromUrl();
const ROW_COUNT_PARAM = new URLSearchParams(window.location.search).get("rows");
const DEMO_ROW_COUNT = ROW_COUNT_PARAM ? Math.min(Number(ROW_COUNT_PARAM) || 480, 50_000) : 480;
const DEMO_DATA = DEMO_ROW_COUNT > 480 ? generateSalesData(DEMO_ROW_COUNT) : SALES_DATA;

/**
 * WDR-like showcase powered by @salec/pivot-ui PivotApp.
 * Enable drill-through with ?drill=1
 */
export function App() {
  const drill = new URLSearchParams(window.location.search).get("drill") === "1";

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <h1 className="text-base font-semibold text-zinc-900">SavdoDesk Pivot Demo</h1>
        <p className="text-xs text-zinc-500">
          Embeddable @salec/pivot-ui · {DEMO_DATA.length.toLocaleString("ru-RU")} rows
          {drill ? " · drill-through on" : " · add ?drill=1 for raw records"}
        </p>
      </header>
      <PivotApp
        data={DEMO_DATA}
        fields={SALES_FIELDS}
        config={{
          ...DEFAULT_DEMO_CONFIG,
          ...URL_CONFIG,
          options: {
            showSubtotals: true,
            showGrandTotal: true,
            showColumnTotals: false,
            compactMode: false,
            drillDown: true,
            drillThrough: drill,
            conditionalFormats: withHeatmapPresets()
          }
        }}
        options={{
          locale: "ru",
          drillThrough: drill,
          theme: "heatmap",
          useWorker: true
        }}
      />
    </div>
  );
}
