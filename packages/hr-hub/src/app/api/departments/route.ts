import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { requireApiSession } from "@/lib/api";

export async function GET() {
  const auth = await requireApiSession();
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.orgId, auth.user.orgId))
    .orderBy(asc(departments.name));

  return NextResponse.json({ items: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function POST(req: Request) {
  const auth = await requireApiSession(["org_admin", "manager"]);
  if (auth instanceof NextResponse) return auth;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [row] = await db
    .insert(departments)
    .values({
      orgId: auth.user.orgId,
      name: parsed.data.name.trim(),
    })
    .returning();

  return NextResponse.json({ item: row }, { status: 201 });
}
