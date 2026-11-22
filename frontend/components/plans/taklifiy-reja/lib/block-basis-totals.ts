import type { Basis, ProposalRow } from "@salec/plans-proposal";
import type { MatrixRow } from "./grouping";
import { acceptedPreviousPlan, hasUsableFact } from "./source";

export type BlockBasis = Extract<Basis, "fact" | "previous_plan">;
export type SourceStatus = "approved_only" | "official";

/** Bitta katak uchun asos summasi (tiyin). Tayyor taklif bo‘lmasa ham. */
export function basisAmountForCell(
  cell: ProposalRow | undefined,
  basis: BlockBasis,
  sourceStatus: SourceStatus = "approved_only"
): bigint {
  if (!cell) return 0n;
  if (basis === "fact") {
    if (!hasUsableFact(cell)) return 0n;
    try {
      return BigInt(cell.employee.fact!.net);
    } catch {
      return 0n;
    }
  }
  const plan = acceptedPreviousPlan(cell, sourceStatus);
  if (!plan) return 0n;
  try {
    return BigInt(plan.value);
  } catch {
    return 0n;
  }
}

/** Blok ichidagi agentlar × bitta KPI uchun asos jami. Boshqa KPI aralashmaydi. */
export function sumBlockBasis(
  rows: MatrixRow[],
  kpiId: number,
  basis: BlockBasis,
  sourceStatus: SourceStatus = "approved_only"
): bigint {
  let sum = 0n;
  for (const row of rows) {
    sum += basisAmountForCell(row.cells[kpiId], basis, sourceStatus);
  }
  return sum;
}
