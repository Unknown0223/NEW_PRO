import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { attendanceLogs, employees } from "@/db/schema";
import { requireApiSession } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "30") || 30));

  const conditions = [eq(attendanceLogs.orgId, auth.user.orgId)];
  if (employeeId) {
    conditions.push(eq(attendanceLogs.employeeId, employeeId));
  }
  if (auth.user.role === "employee" && auth.user.employeeId) {
    conditions.push(eq(attendanceLogs.employeeId, auth.user.employeeId));
  }

  const where = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceLogs)
    .where(where);

  const rows = await db
    .select({
      id: attendanceLogs.id,
      type: attendanceLogs.type,
      method: attendanceLogs.method,
      isAnomaly: attendanceLogs.isAnomaly,
      note: attendanceLogs.note,
      createdAt: attendanceLogs.createdAt,
      employeeId: attendanceLogs.employeeId,
      employeeName: employees.fullName,
      location: attendanceLogs.location,
    })
    .from(attendanceLogs)
    .leftJoin(employees, eq(attendanceLogs.employeeId, employees.id))
    .where(where)
    .orderBy(desc(attendanceLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return NextResponse.json({ items: rows, page, pageSize, total: count });
}

const createSchema = z.object({
  employeeId: z.string().uuid().optional(),
  type: z.enum(["check_in", "check_out", "break_start", "break_end"]),
  method: z.enum(["qr", "geofence", "manual", "face_id"]).default("manual"),
  note: z.string().max(500).optional().nullable(),
  location: z.record(z.unknown()).optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  let employeeId = parsed.data.employeeId;
  if (auth.user.role === "employee") {
    if (!auth.user.employeeId) {
      return NextResponse.json({ error: "Employee profile bog‘lanmagan" }, { status: 400 });
    }
    employeeId = auth.user.employeeId;
  }
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId majburiy" }, { status: 400 });
  }

  const [emp] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.orgId, auth.user.orgId)))
    .limit(1);
  if (!emp) {
    return NextResponse.json({ error: "Xodim topilmadi" }, { status: 404 });
  }

  const [row] = await db
    .insert(attendanceLogs)
    .values({
      orgId: auth.user.orgId,
      employeeId,
      type: parsed.data.type,
      method: parsed.data.method,
      note: parsed.data.note ?? null,
      location: parsed.data.location ?? { source: "web" },
    })
    .returning();

  return NextResponse.json({ item: row }, { status: 201 });
}
