"use client";

type Row = { category: string; count: number };

export function ClientMapCategoryStats({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-3 pb-4 pt-1 text-sm text-slate-400">Нет данных по категориям.</div>
    );
  }

  return (
    <div className="px-3 pb-4 pt-1">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.category} className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-400">{row.category}</span>
            <span className="font-semibold tabular-nums text-black">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
