import { NextResponse } from "next/server";
import { db } from "@/db";
import { tradeDirections } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(tradeDirections);
  return NextResponse.json(rows);
}
