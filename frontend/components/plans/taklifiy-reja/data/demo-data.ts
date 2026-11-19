import {
  periodKey,
  previousPeriod,
  shiftPeriod,
  type DirectionContext,
  EmployeeSource,
  type MultiProposalInput,
  type Period,
  type ProposalConfig,
  type ProposalContext,
  type ProposalInput
} from "@salec/plans-proposal";

export const DEMO_TODAY = "2026-11-14";
export const DIRECTIONS = [
  { id: 1, name: "Toshkent savdo" },
  { id: 2, name: "Viloyatlar savdosi" }
];
export const KPI_GROUPS = [
  { id: 1, directionId: 1, name: "Asosiy assortiment", products: 24 },
  { id: 2, directionId: 1, name: "Yangi mahsulotlar", products: 8 },
  { id: 3, directionId: 1, name: "Premium assortiment", products: 12 },
  { id: 4, directionId: 2, name: "Viloyat — asosiy", products: 18 },
  { id: 5, directionId: 2, name: "Viloyat — yangi", products: 6 }
];
export const BRANCHES = [
  { id: 1, name: "Toshkent markaz" },
  { id: 2, name: "Chirchiq" },
  { id: 3, name: "Samarqand" },
  { id: 4, name: "Buxoro" }
];

const NAMES = [
  "Aziz Karimov",
  "Dilnoza Rahimova",
  "Jasur Toshpo‘latov",
  "Malika Yusupova",
  "Sardor Aliyev",
  "Nilufar Ergasheva",
  "Bobur Nazarov",
  "Zarina Sobirova",
  "Otabek Umarov",
  "Madina Islomova",
  "Sherzod Qodirov",
  "Kamola Rustamova",
  "Bekzod Mirzayev",
  "Sevara Nazarova",
  "Akmal Hasanov",
  "Gulnoza Karimova",
  "Doston Rasulov",
  "Feruza Akbarova",
  "Sanjar Yo‘ldoshev",
  "Mohira Tosheva"
];

const uzs = (n: number) => (BigInt(Math.round(n)) * 100n).toString();
const CURRENT = { year: 2026, month: 11 };
const monthIndex = (p: Period) => p.year * 12 + p.month;
const isFutureOrCurrent = (p: Period) => monthIndex(p) >= monthIndex(CURRENT);

function historyFor(id: number, groupId: number, source: Period, base: number) {
  const out: EmployeeSource["history"] = [];
  for (let i = 1; i <= 6; i++) {
    const period = shiftPeriod(source, -i);
    if (isFutureOrCurrent(period)) continue;
    const wave = [0.94, 1.03, 0.98, 1.08, 0.91, 1.01][(id + i + groupId) % 6]!;
    out.push({ period: periodKey(period), net: uzs(base * wave) });
  }
  return out;
}

export function directionKpiIds(directionId: number): number[] {
  return KPI_GROUPS.filter((g) => g.directionId === directionId).map((g) => g.id);
}

/** Sintetik, deterministik dataset. Hech qanday real mijoz yoki production ma’lumoti yo'q. */
export function buildDemoEmployees(context: ProposalContext): EmployeeSource[] {
  const group = KPI_GROUPS.find((g) => g.id === context.kpiGroupId)!;
  const sourcePartial = periodKey(context.source) === periodKey(CURRENT);
  const sourceFuture = monthIndex(context.source) > monthIndex(CURRENT);
  const ids =
    context.directionId === 1
      ? Array.from({ length: 14 }, (_, i) => i + 1)
      : Array.from({ length: 6 }, (_, i) => i + 15);
  return ids.map((id): EmployeeSource => {
    const local = context.directionId === 1 ? id : id - 14;
    const branchId =
      context.directionId === 1 ? (local <= 6 ? 1 : local <= 10 ? 2 : 3) : local <= 3 ? 3 : 4;
    const supervisorId = branchId === 1 ? 101 : branchId === 2 ? 102 : branchId === 3 ? 103 : 104;
    const supervisor = ["", "Akbar Sodiqov", "Lola Mirzayeva", "Rustam Karimov", "Nodira Alimova"][
      branchId
    ]!;
    const base = (55 + ((id * 17 + group.id * 11) % 95)) * 1_000_000;
    const monthWave = 0.92 + ((monthIndex(context.source) + id) % 5) * 0.035;
    const partialFactor = sourcePartial ? 0.52 : 1;
    const newAgent = id === 7 || id === 18;
    const zeroFact = id === 8;
    const negative = id === 9;
    const outlier = id === 10;
    const missingFact = id === 11 || newAgent;
    const net = zeroFact
      ? 0
      : negative
        ? -2_000_000
        : outlier
          ? base * 3.1
          : Math.round(base * monthWave * partialFactor);
    const returns = negative ? 10_000_000 : Math.round(base * 0.06);
    const gross = net + returns;
    const linked = !(id === 12 && group.id === 1) && !(id === 19 && group.id === 4);
    const planMissing = newAgent || id === 13;
    const planStatus = id === 14 || id === 20 ? "pending_approval" : "approved";
    const planValue = zeroFact ? 0 : Math.round((base * 1.08) / 100000) * 100000;
    const observedDays = sourcePartial ? 14 : 26;
    return {
      employeeId: id,
      workSlotId: 1000 + id,
      name: NAMES[id - 1]!,
      code: `AG-${String(id).padStart(3, "0")}`,
      role: "agent",
      branchId,
      branch: BRANCHES.find((b) => b.id === branchId)!.name,
      supervisorId,
      supervisor,
      linked,
      active: id !== 13,
      fact:
        sourceFuture || missingFact
          ? null
          : {
              status: sourcePartial ? "provisional" : "final",
              gross: uzs(gross),
              returns: uzs(returns),
              net: uzs(net),
              observedDays,
              daysInMonth: 30,
              updatedAt: sourcePartial
                ? `${DEMO_TODAY}T09:00:00+05:00`
                : `${periodKey(context.source)}-28T18:00:00+05:00`
            },
      previousPlan:
        sourceFuture || planMissing
          ? null
          : {
              status: planStatus,
              value: uzs(planValue),
              updatedAt: `${periodKey(context.source)}-01T10:00:00+05:00`
            },
      history: newAgent ? [] : historyFor(id, group.id, context.source, base)
    };
  });
}

export function buildDemoInput(context: ProposalContext, config: ProposalConfig): ProposalInput {
  return { context, config, employees: buildDemoEmployees(context) };
}

export function buildMultiDemoInput(
  context: DirectionContext,
  configs: Record<string, ProposalConfig>,
  kpiGroupIds: number[]
): MultiProposalInput {
  return {
    context,
    configs,
    datasets: kpiGroupIds.map((kpiGroupId) => ({
      kpiGroupId,
      employees: buildDemoEmployees({ ...context, kpiGroupId })
    }))
  };
}

export const INITIAL_CONTEXT: DirectionContext = {
  tenantId: 1,
  directionId: 1,
  target: { year: 2026, month: 12 },
  source: previousPeriod({ year: 2026, month: 12 }),
  metric: "cost"
};
