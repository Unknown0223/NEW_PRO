import type { MonitoringDraft } from "@/components/dashboard/monitoring/types";
import type { TerritoryNode } from "@/lib/territory-tree";
import { sortForest } from "@/lib/territory-tree";

export function territoryTreeIdsToFilterLists(
  nodes: TerritoryNode[],
  selectedIds: string[]
): Pick<MonitoringDraft, "territory_1_list" | "territory_2_list" | "territory_3_list"> {
  const sel = new Set(selectedIds);
  const zones = new Set<string>();
  const regions = new Set<string>();
  const cities = new Set<string>();

  const applySubtree = (n: TerritoryNode, depth: number) => {
    if (n.active === false) return;
    const name = n.name.trim();
    if (name) {
      if (depth === 0) zones.add(name);
      else if (depth === 1) regions.add(name);
      else cities.add(name);
    }
    for (const ch of n.children ?? []) applySubtree(ch, depth + 1);
  };

  const walk = (list: TerritoryNode[], depth: number) => {
    for (const n of list) {
      if (sel.has(n.id)) applySubtree(n, depth);
      else if (n.children?.length) walk(n.children, depth + 1);
    }
  };

  walk(sortForest(nodes), 0);
  return {
    territory_1_list: Array.from(zones).sort((a, b) => a.localeCompare(b, "ru")),
    territory_2_list: Array.from(regions).sort((a, b) => a.localeCompare(b, "ru")),
    territory_3_list: Array.from(cities).sort((a, b) => a.localeCompare(b, "ru"))
  };
}

export function nodeMatchesSearch(node: TerritoryNode, q: string): boolean {
  if (!q) return true;
  const hay = `${node.name} ${node.code ?? ""}`.toLowerCase();
  if (hay.includes(q)) return true;
  return (node.children ?? []).some((c) => nodeMatchesSearch(c, q));
}

export function collectSubtreeIds(node: TerritoryNode): string[] {
  const ids = [node.id];
  for (const c of node.children ?? []) ids.push(...collectSubtreeIds(c));
  return ids;
}

export type TerritoryTreeIndex = {
  subtreeIdsByNodeId: Map<string, readonly string[]>;
  idToName: Map<string, string>;
};

export function buildTerritoryTreeIndex(forest: TerritoryNode[]): TerritoryTreeIndex {
  const subtreeIdsByNodeId = new Map<string, readonly string[]>();
  const idToName = new Map<string, string>();

  const walk = (node: TerritoryNode) => {
    idToName.set(node.id, node.name);
    subtreeIdsByNodeId.set(node.id, collectSubtreeIds(node));
    for (const c of node.children ?? []) walk(c);
  };

  for (const n of forest) walk(n);
  return { subtreeIdsByNodeId, idToName };
}

export function territorySelectionEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((id) => sa.has(id));
}
