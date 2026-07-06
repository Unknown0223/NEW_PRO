import { NextResponse } from "next/server";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const tradeDirectionId = searchParams.get("tradeDirectionId");
  const kpiGroupId = searchParams.get("kpiGroupId");

  let query = db.select().from(plans);
  const conditions = [];

  if (month) conditions.push(eq(plans.month, parseInt(month)));
  if (year) conditions.push(eq(plans.year, parseInt(year)));
  if (tradeDirectionId) conditions.push(eq(plans.tradeDirectionId, parseInt(tradeDirectionId)));
  if (kpiGroupId) conditions.push(eq(plans.kpiGroupId, parseInt(kpiGroupId)));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const result = await db.insert(plans).values(body).returning();
  return NextResponse.json(result[0]);
}
