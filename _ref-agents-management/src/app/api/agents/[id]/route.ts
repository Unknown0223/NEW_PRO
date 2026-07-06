import { NextRequest, NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  const [agent] = await db.select().from(agents).where(eq(agents.id, id));
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [{ value }] = await db
    .select({ value: count() })
    .from(agentSessions)
    .where(eq(agentSessions.agentId, id));
  return NextResponse.json({ ...agent, activeSessions: value });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  const body = await req.json();

  const patch: Partial<typeof agents.$inferInsert> = {};
  const strFields = [
    "firstName",
    "lastName",
    "middleName",
    "code",
    "phone",
    "email",
    "pinfl",
    "agentType",
    "login",
    "warehouse",
    "tradeDirection",
    "branch",
    "position",
    "kpiColor",
    "apkVersion",
    "deviceName",
  ] as const;
  for (const f of strFields) {
    if (typeof body[f] === "string") patch[f] = body[f];
  }
  if (typeof body.consignation === "boolean") patch.consignation = body.consignation;
  if (typeof body.appAccess === "boolean") patch.appAccess = body.appAccess;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.maxSessions === "number" && body.maxSessions >= 1) {
    patch.maxSessions = Math.min(10, Math.floor(body.maxSessions));
  }
  if (Array.isArray(body.priceTypes)) patch.priceTypes = body.priceTypes;
  if (Array.isArray(body.products)) {
    patch.products = body.products;
    patch.productCount = body.products.length;
  }

  if (
    patch.firstName !== undefined ||
    patch.lastName !== undefined ||
    patch.middleName !== undefined
  ) {
    const [current] = await db.select().from(agents).where(eq(agents.id, id));
    if (!current)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    patch.fullname = [
      patch.lastName ?? current.lastName,
      patch.firstName ?? current.firstName,
      patch.middleName ?? current.middleName,
    ]
      .filter((s) => s?.trim())
      .join(" ")
      .trim();
  }

  const [updated] = await db
    .update(agents)
    .set(patch)
    .where(eq(agents.id, id))
    .returning();
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ value }] = await db
    .select({ value: count() })
    .from(agentSessions)
    .where(eq(agentSessions.agentId, id));
  return NextResponse.json({ ...updated, activeSessions: value });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  await db.delete(agents).where(eq(agents.id, id));
  return NextResponse.json({ ok: true });
}
