import { NextRequest, NextResponse } from "next/server";
import { asc, count, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { buildFilters } from "@/lib/agent-filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const sp = req.nextUrl.searchParams;
  const where = buildFilters(sp);

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 10));
  const sortDir = sp.get("sortDir") === "desc" ? desc : asc;

  const [{ total }] = await db
    .select({ total: count() })
    .from(agents)
    .where(where);

  const rows = await db
    .select({
      agent: agents,
      activeSessions: sql<number>`(
        select count(*)::int from ${agentSessions}
        where ${agentSessions.agentId} = ${agents.id}
      )`,
    })
    .from(agents)
    .where(where)
    .orderBy(sortDir(agents.fullname))
    .limit(limit)
    .offset((page - 1) * limit);

  return NextResponse.json({
    data: rows.map((r) => ({ ...r.agent, activeSessions: r.activeSessions })),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.lastName?.trim() && !body.firstName?.trim()) {
    return NextResponse.json(
      { error: "Имя или фамилия обязательны" },
      { status: 400 }
    );
  }
  if (!body.code?.trim()) {
    return NextResponse.json({ error: "Код обязателен" }, { status: 400 });
  }
  const fullname = [body.lastName, body.firstName, body.middleName]
    .filter((s: string) => s?.trim())
    .join(" ")
    .trim();

  const [created] = await db
    .insert(agents)
    .values({
      firstName: body.firstName ?? "",
      lastName: body.lastName ?? "",
      middleName: body.middleName ?? "",
      fullname,
      code: body.code,
      phone: body.phone ?? "",
      email: body.email ?? "",
      pinfl: body.pinfl ?? "",
      agentType: body.agentType ?? "Торговый представитель",
      consignation: !!body.consignation,
      login: body.login ?? "",
      warehouse: body.warehouse ?? "",
      tradeDirection: body.tradeDirection ?? "",
      branch: body.branch ?? "",
      position: body.position ?? "",
      kpiColor: body.kpiColor ?? "#e11d48",
      priceTypes: Array.isArray(body.priceTypes) ? body.priceTypes : [],
      products: Array.isArray(body.products) ? body.products : [],
      productCount: Array.isArray(body.products) ? body.products.length : 0,
      maxSessions: body.maxSessions ?? 1,
      appAccess: true,
      active: true,
    })
    .returning();

  return NextResponse.json({ ...created, activeSessions: 0 }, { status: 201 });
}
