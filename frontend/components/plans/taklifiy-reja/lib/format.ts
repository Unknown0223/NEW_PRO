import { assertMoney, type Formula, type Money, type ProposalRow } from "@salec/plans-proposal";

export const fmt = (value: Money | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Number(value) / 100);
export const fmtDecimal = (value: number, digits = 1) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);
export const formulaLabel = (f: Formula) =>
  `${f.basis === "fact" ? "Sof fakt" : "Eski reja"} ${f.value < 0 ? "−" : "+"} ${fmtDecimal(Math.abs(f.value), 2)}${f.mode === "percent" ? "%" : " so‘m"}`;
export const rowStatus = (row: ProposalRow) =>
  row.origin === "excluded"
    ? "Chiqarilgan"
    : row.issues.some((i) => i.severity === "blocking")
      ? "Ma’lumot kerak"
      : row.issues.some((i) => i.severity === "warning")
        ? "Tekshiring"
        : "Tayyor";

export function moneyDecimal(value: Money): string {
  const n = assertMoney(value);
  const abs = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
