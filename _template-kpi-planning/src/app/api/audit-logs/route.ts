import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");
  const employeeId = searchParams.get("employeeId");

  let query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  const conditions = [];

  if (planId) conditions.push(eq(auditLogs.planId, parseInt(planId)));
  if (employeeId) conditions.push(eq(auditLogs.employeeId, parseInt(employeeId)));

  if (conditions.length > 0) {
    const { and } = await import("drizzle-orm");
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}
