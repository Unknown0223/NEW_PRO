import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  const rows = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.agentId, id))
    .orderBy(desc(agentSessions.createdAt));
  return NextResponse.json(rows);
}

// Terminate sessions: body { sessionIds?: number[] } — omit for "all"
export async function DELETE(req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  let sessionIds: number[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.sessionIds)) sessionIds = body.sessionIds;
  } catch {
    // no body — terminate all
  }

  if (sessionIds && sessionIds.length > 0) {
    await db
      .delete(agentSessions)
      .where(
        and(
          eq(agentSessions.agentId, id),
          inArray(agentSessions.id, sessionIds)
        )
      );
  } else {
    await db.delete(agentSessions).where(eq(agentSessions.agentId, id));
  }

  const rows = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.agentId, id))
    .orderBy(desc(agentSessions.createdAt));
  return NextResponse.json(rows);
}
