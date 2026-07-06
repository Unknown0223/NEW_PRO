import { NextResponse } from "next/server";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");

  let query = db.select().from(approvals);
  if (planId) {
    query = query.where(eq(approvals.planId, parseInt(planId))) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}
