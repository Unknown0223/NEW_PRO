import { NextResponse } from "next/server";
import { db } from "@/db";
import { kpiGroups } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tradeDirectionId = searchParams.get("tradeDirectionId");

  let query = db.select().from(kpiGroups);
  if (tradeDirectionId) {
    query = query.where(eq(kpiGroups.tradeDirectionId, parseInt(tradeDirectionId))) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}
