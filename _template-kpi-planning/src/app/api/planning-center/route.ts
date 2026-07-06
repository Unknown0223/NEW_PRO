import { NextResponse } from "next/server";
import { db } from "@/db";
import { tradeDirections, kpiGroups, employees, plans, kpiTargets, approvals } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || "1");
  const year = parseInt(searchParams.get("year") || "2026");
  const tradeDirectionId = searchParams.get("tradeDirectionId");
  const kpiGroupId = searchParams.get("kpiGroupId");

  const [directions, groups, allEmployees, allPlans, targets, allApprovals] = await Promise.all([
    db.select().from(tradeDirections),
    kpiGroupId
      ? db.select().from(kpiGroups).where(eq(kpiGroups.id, parseInt(kpiGroupId)))
      : tradeDirectionId
        ? db.select().from(kpiGroups).where(eq(kpiGroups.tradeDirectionId, parseInt(tradeDirectionId)))
        : db.select().from(kpiGroups),
    db.select().from(employees),
    db.select().from(plans).where(and(eq(plans.month, month), eq(plans.year, year))),
    db.select().from(kpiTargets),
    db.select().from(approvals),
  ]);

  const planMap = new Map(allPlans.map((p) => [p.id, p]));
  const targetMap = new Map(targets.map((t) => [`${t.planId}-${t.employeeId}`, t]));
  const approvalMap = new Map<number, typeof allApprovals>();
  for (const a of allApprovals) {
    const arr = approvalMap.get(a.planId) || [];
    arr.push(a);
    approvalMap.set(a.planId, arr);
  }

  return NextResponse.json({
    tradeDirections: directions,
    kpiGroups: groups,
    employees: allEmployees,
    plans: allPlans,
    kpiTargets: targets,
    approvals: allApprovals,
  });
}
