import type { InitialSetupPreviewState } from "@/lib/initial-setup/types";
import type { StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { revalidatePreviewRows } from "@/lib/initial-setup/row-validation";
import { rescueWidePriceRows } from "@/lib/initial-setup/preview-xlsx";

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
    rows: revalidatePreviewRows(rows, config),
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

  const payMethods =
    config.profileRefKey === "price_type_entries"
      ? (Array.isArray(profile?.payment_method_entries)
          ? (profile.payment_method_entries as Record<string, unknown>[])
          : []
        ).filter((p) => p != null && typeof p === "object" && !Array.isArray(p))
      : [];

  const rows = raw
    .map((item, i) => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return null;
      const o = item as Record<string, unknown>;
      const cells: Record<string, string> = {};
      for (const col of config.columns) {
        if (col.key === "payment_method") {
          const pmid = typeof o.payment_method_id === "string" ? o.payment_method_id : "";
          const pay = payMethods.find((p) => String(p.id ?? "") === pmid);
          const code = pay ? String(pay.code ?? "").trim() : "";
          const name = pay ? String(pay.name ?? "").trim() : "";
          // Preview/Excel: inson o‘qiydigan nom (kod alohida «Код» ustunida)
          cells[col.key] = name || code || pmid;
          continue;
        }
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
  parent = "",
  depth = 0
): { rowIndex: number; cells: Record<string, string> }[] {
  if (!Array.isArray(nodes)) return [];
  const out: { rowIndex: number; cells: Record<string, string> }[] = [];
  let idx = 1;

  function walk(list: unknown[], zone: string, region: string, d: number) {
    for (const n of list) {
      if (n == null || typeof n !== "object" || Array.isArray(n)) continue;
      const o = n as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : "";
      const code = typeof o.code === "string" ? o.code : o.code != null ? String(o.code) : "";
      const children = Array.isArray(o.children) ? o.children : [];

      if (d === 0) {
        if (children.length) walk(children, name || zone, region, 1);
      } else if (d === 1) {
        if (children.length) walk(children, zone, name || region, 2);
      } else if (children.length) {
        walk(children, zone, region, d + 1);
      } else if (name && zone && region) {
        out.push({
          rowIndex: idx++,
          cells: { name, code, region, zone }
        });
      }
    }
  }

  walk(nodes, parent, "", depth);
  return out;
}

export function mergePreview(
  base: InitialSetupPreviewState,
  external?: InitialSetupPreviewState | null,
  config?: StepTableConfig
): InitialSetupPreviewState {
  if (!external?.rows.length) {
    return { ...base, rows: revalidatePreviewRows(base.rows, config) };
  }

  if (config?.mode === "import" || config?.mode === "company-form") {
    let sourceRows = external.rows;
    let columns =
      external.columns.length >= base.columns.length ? external.columns : base.columns;

    if (config.stepId === "product-prices") {
      const hasPrice = sourceRows.some((r) => String(r.cells.price ?? "").trim());
      if (!hasPrice) {
        const rescued = rescueWidePriceRows(external.rows, 5000);
        if (rescued) {
          sourceRows = rescued.rows;
          columns = rescued.columns;
        }
      }
    }

    return {
      ...external,
      columns,
      rows: revalidatePreviewRows(sourceRows, config)
    };
  }

  function rowKey(cells: Record<string, string>): string {
    const code = cells.code?.trim().toLowerCase();
    const name = cells.name?.trim().toLowerCase();
    return code || name || "";
  }

  const map = new Map<string, InitialSetupPreviewState["rows"][0]>();
  for (const r of revalidatePreviewRows(base.rows, config)) {
    const k = rowKey(r.cells) || `_base_${r.rowIndex}`;
    map.set(k, r);
  }
  for (const r of revalidatePreviewRows(external.rows, config)) {
    const k = rowKey(r.cells) || `_ext_${r.rowIndex}`;
    map.set(k, r);
  }

  return {
    columns: base.columns.length ? base.columns : external.columns,
    rows: revalidatePreviewRows(Array.from(map.values()), config),
    fileName: external.fileName || base.fileName
  };
}
