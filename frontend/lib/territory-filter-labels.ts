import { cityStoredCodeToDisplayLabel } from "@/lib/city-territory-hint";
import type { TerritoryNode } from "@/lib/territory-tree";

function normTrim(s: string): string {
  return String(s ?? "").trim();
}

/** Hudud daraxti tugunlaridan kod → nom xaritasi. */
export function addTerritoryNodesToLabelMap(nodes: TerritoryNode[] | undefined, m: Map<string, string>): void {
  if (!nodes?.length) return;
  const walk = (list: TerritoryNode[]) => {
    for (const n of list) {
      const name = normTrim(n.name);
      const code = normTrim(n.code ?? "");
      if (name) {
        m.set(name, name);
        m.set(name.toLowerCase(), name);
      }
      if (code) {
        const label =
          name && name !== code ? name : cityStoredCodeToDisplayLabel(code, name || undefined);
        m.set(code, label);
        m.set(code.toLowerCase(), label);
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
}

export type CityTerritoryHintLabelRow = { city_label?: string | null };

/**
 * Filtrlarda saqlangan kod/token → ko‘rinadigan yozuv.
 * Kalit sifatida `value` (stored) ishlatiladi — `label` noto‘g‘ri bo‘lishi mumkin.
 */
export function createTerritoryLabelResolver(input: {
  zones?: string[] | undefined;
  region_options?: { value: string; label?: string | null }[] | undefined;
  city_options?: { value: string; label?: string | null }[] | undefined;
  city_territory_hints?: Record<string, CityTerritoryHintLabelRow> | undefined;
  territory_nodes?: TerritoryNode[] | undefined;
}): (raw: string) => string {
  const m = new Map<string, string>();
  const put = (key: string, label: string) => {
    const k = normTrim(key);
    const lb = normTrim(label);
    if (!k) return;
    if (!m.has(k)) m.set(k, lb || k);
    m.set(k.toLowerCase(), lb || k);
  };
  for (const z of input.zones ?? []) put(z, z);
  for (const o of input.region_options ?? []) put(o.value, o.label || o.value);
  for (const o of input.city_options ?? []) {
    put(o.value, cityStoredCodeToDisplayLabel(o.value, o.label || o.value));
  }
  for (const [hintKey, hint] of Object.entries(input.city_territory_hints ?? {})) {
    const cl = normTrim(hint?.city_label ?? "");
    if (cl) put(hintKey, cl);
  }
  addTerritoryNodesToLabelMap(input.territory_nodes, m);
  return (raw: string) => {
    const t = normTrim(raw);
    if (!t || t === "—") return t || "—";
    return m.get(t) ?? m.get(t.toLowerCase()) ?? cityStoredCodeToDisplayLabel(t);
  };
}
