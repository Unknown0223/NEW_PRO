"use client";

import { api } from "@/lib/api";
import { branchTerritoryCityDepths, type TerritoryNode } from "@/lib/territory-tree";
import {
  depthToTerritoryLayer,
  resolveLayerLabels,
  territoryLayerToApiKind,
  type TerritoryLayer
} from "@/lib/geo-territory-layers";
import { STALE } from "@/lib/query-stale";
import type { GeoBoundaryKind } from "@/lib/geo-boundaries-types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type BranchRow = {
  id: string;
  name: string;
  code?: string | null;
  active?: boolean;
};

export type GeoCatalogItem = {
  kind: GeoBoundaryKind;
  ref_id: string;
  name: string;
  subtitle?: string;
  /** Filial yoki hudud darajasi */
  layer?: TerritoryLayer;
  depth: number;
  isBranch?: boolean;
  /** Gorod uchun — viloyat (oblast) nomi. */
  parentRegionName?: string;
};

type FlatNode = { node: TerritoryNode; depth: number; parent: TerritoryNode | null };

function flattenTerritoryNodes(nodes: TerritoryNode[], parent: TerritoryNode | null = null, depth = 0): FlatNode[] {
  const out: FlatNode[] = [];
  for (const n of nodes) {
    if (n.active === false) continue;
    out.push({ node: n, depth, parent });
    if (n.children?.length) out.push(...flattenTerritoryNodes(n.children, n, depth + 1));
  }
  return out;
}

function findOblastAncestor(parent: TerritoryNode | null, territoryDepth: number, flat: FlatNode[]): string | undefined {
  let cur: TerritoryNode | null = parent;
  while (cur) {
    const entry = flat.find((f) => f.node.id === cur!.id);
    if (entry && entry.depth === territoryDepth) return cur.name.trim();
    const p = flat.find((f) => f.node.id === cur!.id)?.parent;
    cur = p ?? null;
  }
  return parent?.name?.trim() || undefined;
}

export function useVisitPlannerCatalog(tenantSlug: string | null) {
  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          branches?: BranchRow[];
          territory_nodes?: TerritoryNode[];
          territory_levels?: string[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data;
    }
  });

  const catalog = useMemo(() => {
    const refs = profileQ.data?.references;
    const branches = (refs?.branches ?? [])
      .filter((b) => b.active !== false && b.name?.trim())
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const nodes = refs?.territory_nodes ?? [];
    const levels = refs?.territory_levels ?? [];
    const treeDepth = 3;
    const { territoryDepth } = branchTerritoryCityDepths(levels.length, treeDepth);

    const items: GeoCatalogItem[] = [];

    for (const b of branches) {
      items.push({
        kind: "branch",
        ref_id: b.id,
        name: b.name,
        subtitle: b.code ?? undefined,
        depth: -1,
        isBranch: true
      });
    }

    const flat = flattenTerritoryNodes(nodes);
    for (const { node, depth, parent } of flat) {
      if (!node.name.trim()) continue;
      const layer = depthToTerritoryLayer(depth, levels.length, treeDepth);
      if (!layer) continue;

      const parentRegionName =
        layer === "gorod" ? findOblastAncestor(parent, territoryDepth, flat) : layer === "oblast" ? node.name.trim() : undefined;

      items.push({
        kind: territoryLayerToApiKind(layer),
        ref_id: node.id,
        name: node.name,
        subtitle: node.code ?? undefined,
        layer,
        depth,
        parentRegionName
      });
    }

    return items;
  }, [profileQ.data]);

  const layerLabels = useMemo(
    () => resolveLayerLabels(profileQ.data?.references?.territory_levels),
    [profileQ.data]
  );

  const itemsByKind = useMemo(
    () => ({
      branch: catalog.filter((c) => c.isBranch),
      zone: catalog.filter((c) => c.layer === "zona"),
      territory: catalog.filter((c) => c.layer === "oblast" || c.layer === "gorod")
    }),
    [catalog]
  );

  const itemsByLayer = useMemo(
    () => ({
      branch: catalog.filter((c) => c.isBranch),
      zona: catalog.filter((c) => c.layer === "zona"),
      oblast: catalog.filter((c) => c.layer === "oblast"),
      gorod: catalog.filter((c) => c.layer === "gorod")
    }),
    [catalog]
  );

  return { profileQ, catalog, itemsByKind, itemsByLayer, layerLabels };
}
