function formatIdDelta(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

export function formatOrderChangeSummary(action: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") return "—";
  const p = payload as Record<string, unknown>;
  if (action === "meta") {
    const wh = p.warehouse_id as { from?: unknown; to?: unknown } | undefined;
    const ag = p.agent_id as { from?: unknown; to?: unknown } | undefined;
    const ex = p.expeditor_user_id as { from?: unknown; to?: unknown } | undefined;
    const parts: string[] = [];
    if (wh) parts.push(`Ombor ID: ${formatIdDelta(wh.from)} → ${formatIdDelta(wh.to)}`);
    if (ag) parts.push(`Agent ID: ${formatIdDelta(ag.from)} → ${formatIdDelta(ag.to)}`);
    if (ex) parts.push(`Dastavchik ID: ${formatIdDelta(ex.from)} → ${formatIdDelta(ex.to)}`);
    return parts.join("; ") || "—";
  }
  if (action === "lines") {
    const ts = p.total_sum as { from?: string; to?: string } | undefined;
    const bs = p.bonus_sum as { from?: string; to?: string } | undefined;
    const ds = p.discount_sum as { from?: string; to?: string } | undefined;
    const da = p.discount_alert as { from?: unknown; to?: unknown } | undefined;
    const ba = p.bonus_alert as { from?: unknown; to?: unknown } | undefined;
    const paid = p.paid_lines as {
      from?: Array<{ product_id?: number; qty?: string }>;
      to?: Array<{ product_id?: number; qty?: string }>;
    } | undefined;
    const parts: string[] = [];
    if (ts && ts.from !== ts.to) parts.push(`Сумма: ${ts.from ?? "—"} → ${ts.to ?? "—"}`);
    if (bs && bs.from !== bs.to) parts.push(`Бонус: ${bs.from ?? "—"} → ${bs.to ?? "—"}`);
    if (ds && ds.from !== ds.to) parts.push(`Скидка: ${ds.from ?? "—"} → ${ds.to ?? "—"}`);
    if (da && String(da.from ?? "") !== String(da.to ?? "")) {
      parts.push(
        `Скидка-проблема: ${formatIdDelta(da.from) || "нет"} → ${formatIdDelta(da.to) || "нет"}`
      );
    }
    if (ba && String(ba.from ?? "") !== String(ba.to ?? "")) {
      parts.push(
        `Бонус-проблема: ${formatIdDelta(ba.from) || "нет"} → ${formatIdDelta(ba.to) || "нет"}`
      );
    }
    if (p.alerts_resolved === true) {
      const at = typeof p.alerts_resolved_at === "string" ? p.alerts_resolved_at : "";
      parts.push(at ? `Проблемы исправлены (${at})` : "Проблемы исправлены");
    }
    if (paid?.from && paid?.to) {
      const fromN = paid.from.length;
      const toN = paid.to.length;
      if (fromN !== toN) parts.push(`Товары: ${fromN} → ${toN} поз.`);
      else parts.push("Товары обновлены");
    }
    return parts.join("; ") || "Строки заказа обновлены";
  }
  return JSON.stringify(payload);
}

export function changeLogActionLabel(action: string): string {
  if (action === "lines") return "Редактирование товаров / бонус / скидка";
  if (action === "meta") return "Ombor / agent / dastavchik";
  return action;
}
