import { NextResponse } from "next/server";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { departments, employees } from "@/db/schema";
import { csvEscape, requireApiSession } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status");
  const departmentId = url.searchParams.get("departmentId");
  const format = url.searchParams.get("format");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));

  const conditions = [eq(employees.orgId, auth.user.orgId)];
  if (q) {
    conditions.push(
      or(
        ilike(employees.fullName, `%${q}%`),
        ilike(employees.email, `%${q}%`),
        ilike(employees.position, `%${q}%`)
      )!
    );
  }
  if (status) {
    conditions.push(
      eq(
        employees.status,
        status as "candidate" | "onboarding" | "active" | "on_vacation" | "terminated"
      )
    );
  }
  if (departmentId) {
    conditions.push(eq(employees.departmentId, departmentId));
  }

  const where = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(where);

  const rows = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      email: employees.email,
      phone: employees.phone,
      position: employees.position,
      status: employees.status,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      hiredAt: employees.hiredAt,
      createdAt: employees.createdAt,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(where)
    .orderBy(asc(employees.fullName))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  if (format === "csv") {
    const header = ["fullName", "email", "phone", "position", "status", "department", "hiredAt"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvEscape(r.fullName),
          csvEscape(r.email),
          csvEscape(r.phone ?? ""),
          csvEscape(r.position),
          csvEscape(r.status),
          csvEscape(r.departmentName ?? ""),
          csvEscape(r.hiredAt?.toISOString() ?? ""),
        ].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="employees.csv"',
      },
    });
  }

  return NextResponse.json({
    items: rows,
    page,
    pageSize,
    total: count,
  });
}

const createSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional().nullable(),
  position: z.string().min(1).max(120),
  departmentId: z.string().uuid().optional().nullable(),
  status: z
    .enum(["candidate", "onboarding", "active", "on_vacation", "terminated"])
    .optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiSession(["org_admin", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const [row] = await db
    .insert(employees)
    .values({
      orgId: auth.user.orgId,
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email.toLowerCase(),
      phone: parsed.data.phone ?? null,
      position: parsed.data.position.trim(),
      departmentId: parsed.data.departmentId ?? null,
      status: parsed.data.status ?? "active",
    })
    .returning();

  return NextResponse.json({ item: row }, { status: 201 });
}
