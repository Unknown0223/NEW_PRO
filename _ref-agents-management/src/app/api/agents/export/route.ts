import { NextRequest } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { buildFilters } from "@/lib/agent-filters";

export const dynamic = "force-dynamic";

function esc(v: unknown): string {
  const s = String(v ?? "");
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  await ensureSeeded();
  const where = buildFilters(req.nextUrl.searchParams);
  const rows = await db
    .select()
    .from(agents)
    .where(where)
    .orderBy(asc(agents.fullname));

  const header = [
    "Ф.И.О",
    "Код",
    "ПИНФЛ",
    "Телефон",
    "Логин",
    "Тип агента",
    "Продукт (шт)",
    "Консигнация",
    "Версия APK",
    "Название устройства",
    "Последняя синхронизация",
    "Тип цены",
    "Склад",
    "Направление торговли",
    "Филиал",
    "Должность",
    "Дата создания",
    "Доступ к приложению",
    "Макс. сессий",
    "Активный",
  ];

  const lines = rows.map((a) =>
    [
      a.fullname,
      a.code,
      a.pinfl,
      a.phone,
      a.login,
      a.agentType,
      a.productCount,
      a.consignation ? "Да" : "Нет",
      a.apkVersion,
      a.deviceName,
      a.lastSync ? new Date(a.lastSync).toLocaleString("ru-RU") : "",
      a.priceTypes.join(", "),
      a.warehouse,
      a.tradeDirection,
      a.branch,
      a.position,
      new Date(a.createdAt).toLocaleDateString("ru-RU"),
      a.appAccess ? "Вкл" : "Выкл",
      a.maxSessions,
      a.active ? "Да" : "Нет",
    ]
      .map(esc)
      .join(";")
  );

  const csv = "\uFEFF" + [header.map(esc).join(";"), ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agents.csv"',
    },
  });
}
