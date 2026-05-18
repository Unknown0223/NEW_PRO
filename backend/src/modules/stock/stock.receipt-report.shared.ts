import { parseYmdToDateEnd, parseYmdToDateStart } from "./stock.shared";

export function parseReceiptRange(from: string, to: string): { from: Date; to: Date } {
  return { from: parseYmdToDateStart(from), to: parseYmdToDateEnd(to) };
}
