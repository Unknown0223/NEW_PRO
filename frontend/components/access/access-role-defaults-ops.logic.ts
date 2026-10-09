/** Rol default operatsiyalar — guruhlash (пользователи tab bilan bir xil L1/L2). */
import { displayAccessDescriptionShort, splitPermissionPath } from "@/lib/access-display";

export type RoleGrantedOpRow = {
  key: string;
  module: string;
  section: string | null;
  description: string | null;
  parent_path: string;
};

export type RoleOpL2Group = {
  id: string;
  label: string;
  parent: string;
  rows: RoleGrantedOpRow[];
};

export type RoleOpL1Group = {
  id: string;
  label: string;
  parent: string;
  rows: RoleGrantedOpRow[];
  directRows: RoleGrantedOpRow[];
  children: RoleOpL2Group[];
};

const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

export function shortenPathLabel(path: string, max = 40): string {
  const t = path.trim();
  if (t.length <= max) return t;
  const head = Math.max(8, Math.floor(max * 0.55));
  const tail = max - head - 1;
  return `${t.slice(0, head)}…${t.slice(-tail)}`;
}

export function buildRoleGrantedGroups(rows: RoleGrantedOpRow[]): RoleOpL1Group[] {
  const roots = new Map<
    string,
    { label: string; id: string; rows: RoleGrantedOpRow[]; children: Map<string, RoleOpL2Group> }
  >();

  for (const row of rows) {
    const path = row.parent_path?.trim() || "—";
    const parts = splitPermissionPath(path);
    const l1Label = parts[0] ?? "—";
    let root = roots.get(l1Label);
    if (!root) {
      root = { label: l1Label, id: l1Label, rows: [], children: new Map() };
      roots.set(l1Label, root);
    }
    if (parts.length <= 1) {
      root.rows.push(row);
      continue;
    }
    const l2Label = parts.slice(1).join(" · ");
    const l2Id = `${l1Label}\u0001${l2Label}`;
    let child = root.children.get(l2Label);
    if (!child) {
      child = { id: l2Id, label: l2Label, parent: l2Id, rows: [] };
      root.children.set(l2Label, child);
    }
    child.rows.push(row);
  }

  return [...roots.keys()]
    .sort((a, b) => collator.compare(a, b))
    .map((k) => {
      const r = roots.get(k)!;
      const children = [...r.children.values()].sort((a, b) => collator.compare(a.label, b.label));
      const allRows = [...r.rows, ...children.flatMap((c) => c.rows)];
      return {
        id: r.id,
        label: r.label,
        parent: r.id,
        rows: allRows,
        directRows: r.rows,
        children
      };
    })
    .filter((g) => g.rows.length > 0);
}

export function roleOpDisplayLabel(row: RoleGrantedOpRow): string {
  return displayAccessDescriptionShort(row.description, row.key);
}

export { collator as roleOpCollator };
