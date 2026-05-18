/**
 * Mijoz bo‘yicha akt-sverka: bitta ma’lumot manbai — PDF, JSON API va Excel.
 */
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";

import type { ClientReconciliationChronoLine, ClientReconciliationLoaded } from "./client-reconciliation.types";

export function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatLocalDateLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatLocalDateTimeLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export function decStr(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

export function buildChronological(loaded: ClientReconciliationLoaded): ClientReconciliationChronoLine[] {
  type Line = { t: number; tie: number; row: ClientReconciliationChronoLine };
  const out: Line[] = [];
  let tie = 0;
  for (const o of loaded.ordersInPeriod) {
    const total = o.total_sum;
    out.push({
      t: o.created_at.getTime(),
      tie: tie++,
      row: {
        line_type: "order",
        at: o.created_at.toISOString(),
        ref: o.number,
        debit: decStr(total),
        credit: "0.00",
        description: `Заказ · ${o.order_type} · ${o.status}`
      }
    });
  }
  for (const p of loaded.paymentsInPeriod) {
    out.push({
      t: p.created_at.getTime(),
      tie: tie++,
      row: {
        line_type: "payment",
        at: p.created_at.toISOString(),
        ref: String(p.id),
        debit: "0.00",
        credit: decStr(p.amount),
        description: `Оплата · ${p.payment_type}${p.order?.number ? ` · заказ ${p.order.number}` : ""}${p.note ? ` · ${p.note}` : ""}`
      }
    });
  }
  for (const m of loaded.movementsInPeriod) {
    const d = m.delta;
    const debit = d.gt(0) ? decStr(d) : "0.00";
    const credit = d.lt(0) ? decStr(d.neg()) : "0.00";
    out.push({
      t: m.created_at.getTime(),
      tie: tie++,
      row: {
        line_type: "balance_movement",
        at: m.created_at.toISOString(),
        ref: "",
        debit,
        credit,
        description: m.note?.trim() ? `Движение л/с · ${m.note}` : "Движение лицевого счёта"
      }
    });
  }
  out.sort((a, b) => a.t - b.t || a.tie - b.tie);
  return out.map((x) => x.row);
}

export function safeExcelSheetName(name: string): string {
  let s = name.replace(/[\*\?\\\/\[\]\:]/g, "-").replace(/\s+/g, " ").trim();
  if (s.length > 31) s = `${s.slice(0, 28)}...`;
  return s || "Sheet";
}
