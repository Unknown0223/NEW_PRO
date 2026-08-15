import { bonusAlertLabel } from "@/lib/bonus-alert";
import { discountAlertLabel } from "@/lib/discount-alert";
import { formatNumberGrouped } from "@/lib/format-numbers";

function formatIdDelta(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatMoney(v: unknown): string {
  if (v == null || v === "") return "—";
  return `${formatNumberGrouped(String(v), { maxFractionDigits: 0 })} сум`;
}

function formatAlert(v: unknown): string {
  if (v == null || v === "") return "нет";
  const s = String(v);
  return discountAlertLabel(s) ?? bonusAlertLabel(s) ?? s;
}

function deltaText(
  from: unknown,
  to: unknown,
  format: (v: unknown) => string = formatIdDelta
): string | null {
  if (String(from ?? "") === String(to ?? "")) return null;
  return `${format(from)} → ${format(to)}`;
}

/** order_change_logs / audit payload → qisqa odam tushunadigan xulosa. */
export function formatOrderChangeSummary(action: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const p = payload as Record<string, unknown>;

  if (action === "meta" || action === "order.meta") {
    const parts: string[] = [];
    const wh = p.warehouse_id as { from?: unknown; to?: unknown } | undefined;
    const ag = p.agent_id as { from?: unknown; to?: unknown } | undefined;
    const ex = p.expeditor_user_id as { from?: unknown; to?: unknown } | undefined;
    const pm = p.payment_method_ref as { from?: unknown; to?: unknown } | undefined;
    const block = p.warehouse_block_id as { from?: unknown; to?: unknown } | undefined;
    if (wh) {
      const t = deltaText(wh.from, wh.to);
      if (t) parts.push(`Склад (ID): ${t}`);
    }
    if (ag) {
      const t = deltaText(ag.from, ag.to);
      if (t) parts.push(`Агент (ID): ${t}`);
    }
    if (ex) {
      const t = deltaText(ex.from, ex.to);
      if (t) parts.push(`Экспедитор (ID): ${t}`);
    }
    if (pm) {
      const t = deltaText(pm.from, pm.to);
      if (t) parts.push(`Тип оплаты: ${t}`);
    }
    if (block) {
      const t = deltaText(block.from, block.to);
      if (t) parts.push(`Блок склада (ID): ${t}`);
    }
    if (typeof p.comment === "string" && p.comment.trim()) {
      parts.push(`Комментарий: ${p.comment.trim()}`);
    }
    return parts.join("; ") || "Данные заказа обновлены";
  }

  if (
    action === "lines" ||
    action === "order.lines" ||
    p.paid_lines != null ||
    p.total_sum != null ||
    p.discount_alert != null
  ) {
    const parts: string[] = [];
    const asDelta = (key: string, label: string, format: (v: unknown) => string) => {
      const raw = p[key];
      if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
        const d = raw as { from?: unknown; to?: unknown };
        const t = deltaText(d.from, d.to, format);
        if (t) parts.push(`${label}: ${t}`);
        return;
      }
      if (raw != null && raw !== "") {
        // Flat audit: faqat joriy qiymat
        parts.push(`${label}: ${format(raw)}`);
      }
    };

    asDelta("total_sum", "Сумма", formatMoney);
    asDelta("discount_sum", "Скидка", formatMoney);
    asDelta("bonus_sum", "Бонус", formatMoney);
    asDelta("discount_alert", "Скидка", formatAlert);
    asDelta("bonus_alert", "Бонус", formatAlert);

    if (p.alerts_resolved === true) {
      parts.push("Проблемы скидки/бонуса исправлены");
    }

    const paid = p.paid_lines as
      | { from?: unknown[]; to?: unknown[] }
      | undefined;
    if (paid?.from && paid?.to) {
      const fromN = paid.from.length;
      const toN = paid.to.length;
      parts.push(fromN !== toN ? `Товары: ${fromN} → ${toN} поз.` : "Состав товаров обновлён");
    }

    // Flat auditda order_id ni chiqarmaymiz — shovqin
    return parts.join("; ") || "Товары / сумма обновлены";
  }

  if (action === "consignment.set" || action.includes("consignment.set")) {
    return "Консигнация включена";
  }
  if (action === "consignment.unset" || action.includes("consignment.unset")) {
    return "Консигнация отключена";
  }
  if (action === "return_reason") {
    const reason = typeof p.reason === "string" ? p.reason : typeof p.comment === "string" ? p.comment : "";
    return reason ? `Причина возврата: ${reason}` : "Указана причина возврата";
  }

  return "";
}

export function changeLogActionLabel(action: string): string {
  if (action === "lines" || action === "order.lines") return "Редактирование товаров";
  if (action === "meta" || action === "order.meta") return "Изменение данных заказа";
  if (action === "order.create") return "Заказ создан";
  if (action === "order.status" || action === "status_change") return "Изменение статуса";
  if (action === "order.cancel") return "Заказ отменён";
  if (action.includes("consignment.set")) return "Консигнация";
  if (action.includes("consignment.unset")) return "Консигнация снята";
  if (action === "return_reason") return "Причина возврата";
  return action;
}

/** Detail qatorlari — from/to va alertlarni odam tilida. */
export function formatOrderPayloadDetailRows(payload: unknown): Array<{ label: string; value: string }> {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [];

  const pushDelta = (key: string, label: string, format: (v: unknown) => string) => {
    const raw = p[key];
    if (raw != null && typeof raw === "object" && !Array.isArray(raw) && ("from" in (raw as object) || "to" in (raw as object))) {
      const d = raw as { from?: unknown; to?: unknown };
      const t = deltaText(d.from, d.to, format);
      if (t) rows.push({ label, value: t });
      return;
    }
    if (raw != null && raw !== "") {
      rows.push({ label, value: format(raw) });
    }
  };

  pushDelta("total_sum", "Сумма", formatMoney);
  pushDelta("discount_sum", "Скидка", formatMoney);
  pushDelta("bonus_sum", "Бонус", formatMoney);
  pushDelta("discount_alert", "Проблема скидки", formatAlert);
  pushDelta("bonus_alert", "Проблема бонуса", formatAlert);
  pushDelta("warehouse_id", "Склад (ID)", formatIdDelta);
  pushDelta("agent_id", "Агент (ID)", formatIdDelta);
  pushDelta("expeditor_user_id", "Экспедитор (ID)", formatIdDelta);
  pushDelta("payment_method_ref", "Тип оплаты", formatIdDelta);

  if (p.alerts_resolved === true) {
    rows.push({ label: "Статус проблем", value: "Исправлены" });
  }

  const paid = p.paid_lines as { from?: unknown[]; to?: unknown[] } | undefined;
  if (paid?.from && paid?.to) {
    rows.push({
      label: "Товары",
      value:
        paid.from.length !== paid.to.length
          ? `${paid.from.length} → ${paid.to.length} позиций`
          : `Обновлено (${paid.to.length} поз.)`
    });
  }

  if (typeof p.comment === "string" && p.comment.trim()) {
    rows.push({ label: "Комментарий", value: p.comment.trim() });
  }
  if (typeof p.reason === "string" && p.reason.trim()) {
    rows.push({ label: "Причина", value: p.reason.trim() });
  }

  return rows;
}
