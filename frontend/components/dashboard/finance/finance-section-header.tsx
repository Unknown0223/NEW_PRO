"use client";

/** Shablon: `SectionHeader` */
export function FinanceSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 min-w-0">
      <h2 className="text-lg font-black text-slate-800">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
