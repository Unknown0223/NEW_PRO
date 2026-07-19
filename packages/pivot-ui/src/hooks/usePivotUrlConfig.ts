import { useCallback, useEffect, useRef } from "react";
import type { PivotConfig } from "@salec/pivot-engine";

const PARAM = "pivot";

type UrlConfigSlice = Pick<
  PivotConfig,
  "rows" | "columns" | "values" | "reportFilters" | "filters"
>;

function encodeConfigSlice(config: PivotConfig): string {
  const slice: UrlConfigSlice = {
    rows: config.rows,
    columns: config.columns,
    values: config.values,
    reportFilters: config.reportFilters,
    filters: config.filters
  };
  return btoa(encodeURIComponent(JSON.stringify(slice)));
}

function decodeConfigSlice(encoded: string): Partial<PivotConfig> | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(encoded))) as UrlConfigSlice;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readPivotConfigFromUrl(): Partial<PivotConfig> | null {
  if (typeof window === "undefined") return null;
  const encoded = new URLSearchParams(window.location.search).get(PARAM);
  if (!encoded) return null;
  return decodeConfigSlice(encoded);
}

export function usePivotUrlConfig(config: PivotConfig) {
  const skipNextWrite = useRef(false);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get(PARAM);
    if (encoded) {
      skipNextWrite.current = true;
    }
  }, []);

  const syncUrl = useCallback((next: PivotConfig) => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }

    const url = new URL(window.location.href);
    const hasLayout =
      next.rows.length > 0 ||
      next.columns.length > 0 ||
      next.values.length > 0 ||
      next.reportFilters.length > 0 ||
      next.filters.length > 0;

    if (!hasLayout) {
      url.searchParams.delete(PARAM);
    } else {
      url.searchParams.set(PARAM, encodeConfigSlice(next));
    }

    window.history.replaceState(null, "", url.toString());
  }, []);

  useEffect(() => {
    syncUrl(config);
  }, [config, syncUrl]);
}
