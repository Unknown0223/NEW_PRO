/** Визуальные классы страницы «Возврат с полки» (эталон sales-system-frontend-architecture). */

export const polkiCard =
  "rounded-[10px] border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)] sm:p-5";

export const polkiFieldLabel = "mb-1 block text-xs font-medium text-slate-500";

export const polkiChipBase =
  "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-transparent bg-[#eef1f4] px-3.5 py-2 text-[13px] text-slate-700 transition-colors hover:bg-[#e3e8ed] disabled:pointer-events-none disabled:opacity-50";

export const polkiChipActive =
  "border-[#0a8f7e] bg-[#0a8f7e] text-white hover:bg-[#0a8f7e]";

export const polkiChipCheck =
  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#0a8f7e] text-[10px] font-bold text-white";

export const polkiRadioRow =
  "flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50";

export const polkiRadioRowActive = "text-slate-900";

export const polkiRadioDot =
  "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-slate-300";

export const polkiRadioDotActive = "border-[#0a8f7e] after:block after:h-2 after:w-2 after:rounded-full after:bg-[#0a8f7e] after:content-['']";

export const polkiTab =
  "relative -mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 border-transparent px-1 py-2.5 text-sm text-slate-500 transition-colors hover:text-slate-800";

export const polkiTabActive = "border-[#0a8f7e] font-semibold text-[#0a8f7e]";

export function formatPolkiDocDateLabel(iso: string): string {
  if (!iso.trim()) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
