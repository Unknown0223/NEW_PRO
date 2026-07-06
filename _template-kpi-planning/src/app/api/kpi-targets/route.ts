import { NextResponse } from "next/server";
import { db } from "@/db";
import { kpiTargets, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");
  const employeeId = searchParams.get("employeeId");

  let query = db.select().from(kpiTargets);
  const conditions = [];

  if (planId) conditions.push(eq(kpiTargets.planId, parseInt(planId)));
  if (employeeId) conditions.push(eq(kpiTargets.employeeId, parseInt(employeeId)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = await db.insert(kpiTargets).values(body).returning();
  return NextResponse.json(result[0]);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, oldValue, userName, ...updates } = body;

  const result = await db
    .update(kpiTargets)
    .set({ ...updates, lastUpdated: new Date() })
    .where(eq(kpiTargets.id, id))
    .returning();

  if (oldValue && updates.cost !== undefined) {
    await db.insert(auditLogs).values({
      planId: result[0].planId,
      employeeId: result[0].employeeId,
      field: "cost",
      oldValue: String(oldValue.cost ?? 0),
      newValue: String(updates.cost),
      userName: userName || "System",
    });
  }

  return NextResponse.json(result[0]);
}
