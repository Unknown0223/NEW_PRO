import type { EmployeeSource, ProposalRow, SourcePlan } from "@salec/plans-proposal";

type SourceCarrier = ProposalRow | EmployeeSource;

function employeeOf(value: SourceCarrier): EmployeeSource {
  return "employee" in value ? value.employee : value;
}

/** Fakt mavjud, lekin manfiy yoki 0 bo‘lsa ham taklif uchun asos bo‘la olmaydi. */
export function hasUsableFact(value: SourceCarrier): boolean {
  const net = employeeOf(value).fact?.net;
  if (net == null) return false;
  try {
    return BigInt(net) > 0n;
  } catch {
    return false;
  }
}

/** Yadro bilan bir xil maqom filtri: official bo‘lsa pending_approval ham qabul qilinadi. */
export function acceptedPreviousPlan(
  value: SourceCarrier,
  sourceStatus: "approved_only" | "official" = "approved_only"
): SourcePlan | null {
  const plan = employeeOf(value).previousPlan;
  if (!plan) return null;
  const accepted = sourceStatus === "official" ? ["approved", "pending_approval"] : ["approved"];
  if (!accepted.includes(plan.status)) return null;
  try {
    if (BigInt(plan.value) <= 0n) return null;
  } catch {
    return null;
  }
  return plan;
}
