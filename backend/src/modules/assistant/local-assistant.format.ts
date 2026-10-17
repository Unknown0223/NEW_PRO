export const ALLOWED = [
  "/dashboard/stats",
  "/reports/sales",
  "/reports/receivables",
  "/reports/product-sales",
  "/reports/agent-orders",
  "/reports/order-trends",
  "/orders",
  "/clients",
  "/users",
  "/agents",
  "/products",
  "/payments"
];

export const GUIDE =
  "Avval savolni va oldingi xabarlarni tahlil qil. Keyin faqat JSON: " +
  "{\"calls\":[{\"path\":\"/orders?page=1&limit=15\"}]}. " +
  "Bir nechta mavzu bo'lsa, har biriga alohida path qo'y, ko'pi bilan 3 ta. " +
  "buyurtma=/orders?page=1&limit=15; to'lov=/payments?page=1&limit=15; " +
  "qarz=/reports/receivables?page=1&limit=30; mijoz=/clients?page=1&limit=15; " +
  "xodim=/users; mahsulot=/products?page=1&limit=15; savdo=/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD; " +
  "bugun=/dashboard/stats. Agentni so'rasa buyurtma yoki to'lov pathini ol, butun agent ro'yxatini emas. Faqat GET.";

export function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString("ru-RU") : String(value ?? "");
}

function rowLine(row: Record<string, unknown>) {
  const name = row.name || row.agent_name || row.full_name || row.login || row.number || row.title || row.client_name;
  if (!name) return "";
  const bits = [row.role, row.status, row.phone, row.total_sum != null ? money(row.total_sum) : ""]
    .filter((bit) => bit != null && bit !== "")
    .map(String);
  return bits.length ? `${name}: ${bits.join(", ")}` : String(name);
}

function formatLines(result: unknown): string[] {
  if (!result || typeof result !== "object") return [];
  const data = result as Record<string, unknown> & {
    data?: Array<Record<string, unknown>>;
    agents?: Array<Record<string, unknown>>;
  };
  const lines: string[] = [];
  if (data.clients_total != null || data.orders_today != null) {
    lines.push(`Mijozlar: ${data.clients_total ?? 0}`);
    lines.push(`Faol mahsulot: ${data.products_active ?? 0}`);
    lines.push(`Bugungi buyurtma: ${data.orders_today ?? 0}, ochiq buyurtma: ${data.orders_active ?? 0}`);
    lines.push(`Bugungi to'lov: ${money(data.payments_sum_today)} (${data.payments_today ?? 0} ta)`);
    lines.push(`Ochiq buyurtmalar summasi: ${money(data.open_orders_total)}`);
    return lines;
  }
  const total = data.data?.find((row) => row.period === "total");
  if (total?.order_count != null) {
    lines.push(
      `Buyurtma: ${total.order_count} ta, summa: ${money(total.total_sum)}, to'lov: ${money(total.payment_sum)}, qaytim: ${money(total.return_amount)}`
    );
  }
  for (const agent of (data.agents || []).slice(0, 15)) {
    const line = rowLine(agent);
    if (line) lines.push(line);
  }
  const rows = Array.isArray(data.data) ? data.data : Array.isArray(result) ? (result as Array<Record<string, unknown>>) : [];
  if (rows[0] && "outstanding" in rows[0]) {
    const sum = rows.reduce((acc, row) => acc + Number(row.outstanding || 0), 0);
    const debtors = rows.filter((row) => Number(row.outstanding || 0) > 0);
    lines.push(`Jami ochiq qarz: ${money(sum)}`);
    lines.push(`Qarzdor mijoz: ${debtors.length} ta`);
    for (const row of debtors.slice(0, 12)) {
      lines.push(`${row.name}: ${money(row.outstanding)}`);
    }
    if (!debtors.length) lines.push("Ochiq qarzi bor mijoz yo'q.");
    return lines;
  }
  if (rows[0] && rows[0].amount != null && rows[0].client_name && (rows[0].payment_type != null || rows[0].paid_at != null)) {
    const sum = rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
    lines.push(`To'lovlar: ${rows.length} ta, jami ${money(sum)}`);
    for (const row of rows.slice(0, 12)) {
      const when = String(row.paid_at || row.created_at || "").slice(0, 10);
      lines.push(`${when} ${row.client_name}: ${money(row.amount)}, agent ${row.agent_name || "—"}, ${row.payment_type || ""}`.trim());
    }
    return lines;
  }
  if (rows[0] && rows[0].number != null && rows[0].client_name && rows[0].total_sum != null && rows[0].outstanding == null) {
    const sum = rows.reduce((acc, row) => acc + Number(row.total_sum || 0), 0);
    lines.push(`Buyurtmalar: ${data.total ?? rows.length} ta, ko'rsatilgan summa ${money(sum)}`);
    for (const row of rows.slice(0, 12)) {
      const when = String(row.created_at || "").slice(0, 10);
      lines.push(`${row.number} ${when} ${row.client_name}: ${money(row.total_sum)}, agent ${row.agent_name || "—"}, ${row.status || ""}`.trim());
    }
    return lines;
  }
  if (rows[0] && rows[0].phone != null && rows[0].name && rows[0].outstanding == null && rows[0].total_sum == null) {
    lines.push(`Mijozlar: ${data.total ?? rows.length} ta`);
    for (const row of rows.slice(0, 12)) {
      lines.push(`${row.name}: ${row.phone || "telefon yo'q"}${row.agent_name ? `, agent ${row.agent_name}` : ""}${row.address ? `, ${row.address}` : ""}`);
    }
    return lines;
  }
  if (!total) {
    if (rows.length) lines.push(`Topildi: ${rows.length} ta`);
    for (const row of rows.slice(0, 12)) {
      const line = rowLine(row);
      if (line) lines.push(line);
    }
  }
  return lines;
}

export type TableGroup = { title: string; summary: string; columns: string[]; rows: string[][] };

export function narrow(table: Omit<TableGroup, "title">, mode: { idOnly: boolean; sumOnly: boolean }) {
  if (mode.sumOnly) {
    return { summary: table.summary, columns: ["Jami"], rows: [[table.summary || "0"]] };
  }
  if (!mode.idOnly) return table;
  const idAt = table.columns.findIndex((column) => /raqam|id/i.test(column));
  if (idAt < 0) return table;
  return {
    summary: `${table.rows.length} ta id`,
    columns: ["ID"],
    rows: table.rows.map((row) => [row[idAt] || ""])
  };
}

export function formatTable(result: unknown, mode: { idOnly: boolean; sumOnly: boolean } = { idOnly: false, sumOnly: false }): Omit<TableGroup, "title"> {
  if (!result || typeof result !== "object") return { summary: "", columns: [], rows: [] };
  const data = result as Record<string, unknown> & { data?: Array<Record<string, unknown>>; total?: number };
  const rows = Array.isArray(data.data) ? data.data : [];
  if (data.clients_total != null || data.orders_today != null) {
    return {
      summary: "Umumiy ko'rsatkichlar",
      columns: ["Ko'rsatkich", "Qiymat"],
      rows: [
        ["Mijozlar", String(data.clients_total ?? 0)],
        ["Faol mahsulot", String(data.products_active ?? 0)],
        ["Bugungi buyurtma", String(data.orders_today ?? 0)],
        ["Ochiq buyurtma", String(data.orders_active ?? 0)],
        ["Bugungi to'lov", money(data.payments_sum_today)],
        ["Ochiq buyurtma summasi", money(data.open_orders_total)]
      ]
    };
  }
  if (rows[0] && "outstanding" in rows[0]) {
    const debtors = rows.filter((row) => Number(row.outstanding || 0) > 0);
    const sum = debtors.reduce((acc, row) => acc + Number(row.outstanding || 0), 0);
    return {
      summary: `Jami ${money(sum)} · ${debtors.length} ta mijoz`,
      columns: ["Mijoz", "Qarz"],
      rows: debtors.slice(0, 15).map((row) => [String(row.name || ""), money(row.outstanding)])
    };
  }
  if (rows[0] && rows[0].amount != null && rows[0].client_name && rows[0].payment_type != null) {
    const sum = rows.reduce((acc, row) => acc + Number(row.amount || 0), 0);
    return {
      summary: `${rows.length} ta · jami ${money(sum)}`,
      columns: ["Sana", "Mijoz", "Summa", "Agent", "Tur"],
      rows: rows.slice(0, 15).map((row) => [
        String(row.paid_at || row.created_at || "").slice(0, 10),
        String(row.client_name || ""),
        money(row.amount),
        String(row.agent_name || "—"),
        String(row.payment_type || "")
      ])
    };
  }
  if (rows[0] && rows[0].number != null && rows[0].client_name && rows[0].total_sum != null) {
    const shown = rows.slice(0, 15);
    const sum = shown.reduce((acc, row) => acc + Number(row.total_sum || 0), 0);
    return {
      summary: `${data.total ?? rows.length} ta · ko'rsatilgan ${money(sum)}`,
      columns: ["Raqam", "Sana", "Mijoz", "Summa", "Agent", "Holat"],
      rows: shown.map((row) => [
        String(row.number || ""),
        String(row.created_at || "").slice(0, 10),
        String(row.client_name || ""),
        money(row.total_sum),
        String(row.agent_name || "—"),
        String(row.status || "")
      ])
    };
  }
  if (rows[0] && rows[0].name) {
    return {
      summary: `${data.total ?? rows.length} ta`,
      columns: ["Nomi", "Telefon", "Agent"],
      rows: rows.slice(0, 15).map((row) => [String(row.name), String(row.phone || "—"), String(row.agent_name || row.role || "—")])
    };
  }
  const fallback = formatLines(result);
  return narrow(
    { summary: fallback[0] || "", columns: ["Ma'lumot"], rows: fallback.slice(1).map((line) => [line]) },
    mode
  );
}
