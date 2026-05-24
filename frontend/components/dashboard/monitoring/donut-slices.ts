import type { ShareDonutSlice } from "@/components/charts/analytics-charts-lazy";

export function toDonutSlices(
  rows: Array<{
    name: string;
    value: number;
    share_pct?: number;
    orders_count?: number;
    line_qty?: number;
  }>,
  topN: number,
  othersLabel: string
): ShareDonutSlice[] {
  if (rows.length <= topN) {
    return rows.map((r, i) => ({
      status: `row_${i}`,
      name: r.name,
      value: r.value,
      share_pct: r.share_pct,
      orders_count: r.orders_count,
      line_qty: r.line_qty
    }));
  }
  const head = rows.slice(0, topN);
  const tail = rows.slice(topN);
  const otherVal = tail.reduce((s, r) => s + r.value, 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const otherShare = total > 0 ? (otherVal / total) * 100 : 0;
  return [
    ...head.map((r, i) => ({
      status: `row_${i}`,
      name: r.name,
      value: r.value,
      share_pct: r.share_pct,
      orders_count: r.orders_count,
      line_qty: r.line_qty
    })),
    {
      status: "other",
      name: othersLabel,
      value: otherVal,
      share_pct: Math.round(otherShare * 10) / 10
    }
  ];
}
