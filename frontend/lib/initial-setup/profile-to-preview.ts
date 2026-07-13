import type { InitialSetupPreviewState } from "@/lib/initial-setup/types";
import type { StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { validateRowCells, normalizeRowCells, reindexPreviewRows } from "@/lib/initial-setup/row-validation";

export function emptyPreview(config: StepTableConfig): InitialSetupPreviewState {
  return {
    columns: config.columns.map((c) => c.header),
    rows: [],
    fileName: `${config.stepId}.xlsx`
  };
}

export function previewFromRows(
  config: StepTableConfig,
  rows: { rowIndex: number; cells: Record<string, string> }[]
): InitialSetupPreviewState {
  return {
    columns: config.columns.map((c) => c.header),
    rows: rows.map((r) => {
      const cells = normalizeRowCells(r.cells, config);
      const { errors, warnings } = validateRowCells(cells, undefined, config);
      return { rowIndex: r.rowIndex, cells, errors, warnings };
    }),
    fileName: `${config.stepId}.xlsx`
  };
}

export function profileToPreview(
  config: StepTableConfig,
  profile: Record<string, unknown> | undefined,
  company?: { name?: string; phone?: string | null; address?: string | null }
): InitialSetupPreviewState | null {
  if (config.mode === "company-form") {
    if (!company?.name?.trim()) return null;
    return previewFromRows(config, [
      {
        rowIndex: 1,
        cells: {
          name: company.name ?? "",
          phone: company.phone ?? "",
          address: company.address ?? ""
        }
      }
    ]);
  }

  if (config.mode !== "profile" || !config.profileRefKey) return null;
  const raw = profile?.[config.profileRefKey];
  if (!Array.isArray(raw) || !raw.length) return null;

  const rows = raw
    .map((item, i) => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
      const o = item as Record<string, unknown>;
      const cells: Record<string, string> = {};
      for (const col of config.columns) {
        const v = o[col.key];
        if (col.key === "is_default" && typeof v === "boolean") {
          cells[col.key] = v ? "1" : "0";
        } else if (v != null) {
          cells[col.key] = String(v);
        }
      }
      if (typeof o.id === "string") cells._id = o.id;
      if (!cells.name?.trim()) return null;
      return { rowIndex: i + 1, cells };
    })
    .filter((x): x is { rowIndex: number; cells: Record<string, string> } => x != null);

  return rows.length ? previewFromRows(config, rows) : null;
}

export function flattenTerritoryNodes(
  nodes: unknown,
  parent = ""
): { rowIndex: number; cells: Record<string, string> }[] {
  if (!Array.isArray(nodes)) return [];
  const out: { rowIndex: number; cells: Record<string, string> }[] = [];
  let idx = 1;
  function walk(list: unknown[], p: string) {
    for (const n of list) {
      if (n == null || typeof n !== "object" || Array.isArray(n)) continue;
      const o = n as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : "";
      const level = typeof o.level === "string" ? o.level : "";
      if (name) {
        out.push({
          rowIndex: idx++,
          cells: { name, level, parent: p }
        });
      }
      const children = o.children;
      if (Array.isArray(children) && children.length) walk(children, name || p);
    }
  }
  walk(nodes, parent);
  return out;
}

export function mergePreview(
  base: InitialSetupPreviewState,
  external?: InitialSetupPreviewState | null,
  config?: StepTableConfig
): InitialSetupPreviewState {
  const validateRows = (rows: InitialSetupPreviewState["rows"]) =>
    rows.map((r) => {
      const cells = normalizeRowCells(r.cells, config);
      const { errors, warnings } = validateRowCells(cells, undefined, config);
      return { ...r, cells, errors, warnings };
    });

  if (!external?.rows.length) {
    return { ...base, rows: reindexPreviewRows(validateRows(base.rows)) };
  }

  if (config?.mode === "import" || config?.mode === "company-form") {
    const merged = {
      ...external,
      columns: base.columns.length ? base.columns : external.columns,
      rows: validateRows(external.rows)
    };
    return { ...merged, rows: reindexPreviewRows(merged.rows) };
  }

  function rowKey(cells: Record<string, string>): string {
    const code = cells.code?.trim().toLowerCase();
    const name = cells.name?.trim().toLowerCase();
    return code || name || "";
  }

  const map = new Map<string, InitialSetupPreviewState["rows"][0]>();
  for (const r of validateRows(base.rows)) {
    const k = rowKey(r.cells) || `_base_${r.rowIndex}`;
    map.set(k, r);
  }
  for (const r of validateRows(external.rows)) {
    const k = rowKey(r.cells) || `_ext_${r.rowIndex}`;
    map.set(k, r);
  }

  return {
    columns: base.columns.length ? base.columns : external.columns,
    rows: reindexPreviewRows(Array.from(map.values())),
    fileName: external.fileName || base.fileName
  };
}
