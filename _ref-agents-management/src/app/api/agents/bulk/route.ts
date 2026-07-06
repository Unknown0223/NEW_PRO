import { NextRequest, NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, agentSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

// PATCH /api/agents/bulk
// body: { ids: number[], action: "activate"|"deactivate"|"enable-access"|"disable-access"|"set-warehouse"|"set-branch"|"delete", value?: string }
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids : [];
  const action: string = body.action;
  if (!ids.length) {
    return NextResponse.json({ error: "Не выбраны агенты" }, { status: 400 });
  }

  switch (action) {
    case "activate":
      await db.update(agents).set({ active: true }).where(inArray(agents.id, ids));
      break;
    case "deactivate":
      await db.update(agents).set({ active: false }).where(inArray(agents.id, ids));
      break;
    case "enable-access":
      await db.update(agents).set({ appAccess: true }).where(inArray(agents.id, ids));
      break;
    case "disable-access":
      await db.update(agents).set({ appAccess: false }).where(inArray(agents.id, ids));
      break;
    case "set-warehouse":
      if (!body.value)
        return NextResponse.json({ error: "Укажите склад" }, { status: 400 });
      await db
        .update(agents)
        .set({ warehouse: body.value })
        .where(inArray(agents.id, ids));
      break;
    case "set-branch":
      if (!body.value)
        return NextResponse.json({ error: "Укажите филиал" }, { status: 400 });
      await db
        .update(agents)
        .set({ branch: body.value })
        .where(inArray(agents.id, ids));
      break;
    case "delete":
      await db.delete(agents).where(inArray(agents.id, ids));
      break;
    case "clear-sessions":
      await db.delete(agentSessions).where(inArray(agentSessions.agentId, ids));
      break;
    case "edit": {
      // Only fields common to all agents may be bulk-edited
      const fields = body.fields ?? {};
      const patch: Partial<typeof agents.$inferInsert> = {};
      const strFields = [
        "warehouse",
        "tradeDirection",
        "branch",
        "position",
        "agentType",
      ] as const;
      for (const f of strFields) {
        if (typeof fields[f] === "string" && fields[f]) patch[f] = fields[f];
      }
      if (typeof fields.consignation === "boolean") {
        patch.consignation = fields.consignation;
      }
      if (Array.isArray(fields.priceTypes)) patch.priceTypes = fields.priceTypes;
      if (Array.isArray(fields.products)) {
        patch.products = fields.products;
        patch.productCount = fields.products.length;
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json(
          { error: "Нет изменений для применения" },
          { status: 400 }
        );
      }
      await db.update(agents).set(patch).where(inArray(agents.id, ids));
      break;
    }
    default:
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, affected: ids.length });
}
