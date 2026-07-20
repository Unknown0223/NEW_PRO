import { joinPermissionLabelParts, splitPermissionPath } from "@/lib/access-display";
import type { ModalPickRow } from "@/components/access/access-user-detail/access-user-detail.types";

const PATH_SEP = "\u0001";

/** Modalka «Добавить операции» — 2 bosqichli guruh (modul → bo‘lim → amallar). */
export type OpAttachTreeNode = {
  /** Expand / checkbox uchun barqaror id (`Заявки` yoki `Заявки\u0001Возврат`). */
  id: string;
  label: string;
  /** Shu tugunda to‘g‘ridan-to‘g‘ri amallar (odatda L1 da bo‘sh, L2 da to‘la). */
  items: ModalPickRow[];
  children: OpAttachTreeNode[];
  /** Barcha pastki amallar soni. */
  leafCount: number;
};

export function opAttachNodePathId(segments: string[]): string {
  return segments.map((s) => s.trim()).filter(Boolean).join(PATH_SEP);
}

export function collectOpAttachLeafKeys(node: OpAttachTreeNode): string[] {
  const keys = node.items.map((it) => it.key);
  for (const child of node.children) {
    keys.push(...collectOpAttachLeafKeys(child));
  }
  return keys;
}

export function collectOpAttachExpandableIds(nodes: OpAttachTreeNode[]): string[] {
  const ids: string[] = [];
  for (const n of nodes) {
    if (n.children.length > 0 || n.items.length > 0) {
      // Faqat ichida ochiladigan narsa bo‘lsa (children yoki items)
      if (n.children.length > 0 || n.items.length > 0) ids.push(n.id);
    }
    for (const c of n.children) {
      if (c.children.length > 0 || c.items.length > 0) ids.push(c.id);
      ids.push(...collectOpAttachExpandableIds(c.children));
    }
  }
  return [...new Set(ids)];
}

function countLeaves(node: Omit<OpAttachTreeNode, "leafCount">): number {
  return node.items.length + node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

/**
 * `parent_path` = «Заявки · Возврат» → L1 «Заявки», L2 «Возврат».
 * Bir segmentli («Доступ») — L1 ostida to‘g‘ridan amallar.
 */
export function buildOpAttachTree(items: ModalPickRow[]): OpAttachTreeNode[] {
  type Draft = {
    label: string;
    id: string;
    items: ModalPickRow[];
    children: Map<string, Draft>;
  };

  const roots = new Map<string, Draft>();

  for (const it of items) {
    const path = (it.groupKey ?? "").trim() || "—";
    const segments = splitPermissionPath(path);
    const parts = segments.length > 0 ? segments : ["—"];

    const l1Label = parts[0]!;
    let l1 = roots.get(l1Label);
    if (!l1) {
      l1 = { label: l1Label, id: opAttachNodePathId([l1Label]), items: [], children: new Map() };
      roots.set(l1Label, l1);
    }

    if (parts.length === 1) {
      l1.items.push(it);
      continue;
    }

    // Qolgan segmentlar — bitta L2 (yoki chuqurroq bo‘lsa birlashtirilgan label)
    const restLabel = joinPermissionLabelParts(parts.slice(1));
    const l2Id = opAttachNodePathId([l1Label, ...parts.slice(1)]);
    let l2 = l1.children.get(restLabel);
    if (!l2) {
      l2 = { label: restLabel, id: l2Id, items: [], children: new Map() };
      l1.children.set(restLabel, l2);
    }
    l2.items.push(it);
  }

  const collator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

  function finalize(d: Draft): OpAttachTreeNode {
    const children = [...d.children.values()]
      .map(finalize)
      .sort((a, b) => collator.compare(a.label, b.label));
    const node: Omit<OpAttachTreeNode, "leafCount"> = {
      id: d.id,
      label: d.label,
      items: d.items,
      children
    };
    return { ...node, leafCount: countLeaves(node) };
  }

  return [...roots.values()]
    .map(finalize)
    .sort((a, b) => collator.compare(a.label, b.label));
}
