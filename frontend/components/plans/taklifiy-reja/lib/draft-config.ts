import { DEFAULT_CONFIG, cloneConfig } from "@salec/plans-proposal";
import { directionKpiIds } from "@taklifiy/data/demo-data";
import type { ConfigMap } from "./selection";

export function initialVisibleKpiIds(directionId: number): number[] {
  return directionKpiIds(directionId);
}

export function initialConfigs(directionId: number): ConfigMap {
  return Object.fromEntries(
    directionKpiIds(directionId).map((id) => [String(id), cloneConfig(DEFAULT_CONFIG)])
  );
}
