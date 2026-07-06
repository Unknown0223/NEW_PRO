import { NextResponse } from "next/server";
import { db } from "@/db";
import { employees } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get("parentId");
  const role = searchParams.get("role");

  let query = db.select().from(employees);

  if (parentId === "null") {
    query = query.where(isNull(employees.parentId)) as typeof query;
  } else if (parentId) {
    query = query.where(eq(employees.parentId, parseInt(parentId))) as typeof query;
  }

  if (role) {
    query = query.where(eq(employees.role, role as any)) as typeof query;
  }

  const rows = await query;
  return NextResponse.json(rows);
}
