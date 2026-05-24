export const formatMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " сум";

export const formatNumber = (n: number, digits = 2) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
