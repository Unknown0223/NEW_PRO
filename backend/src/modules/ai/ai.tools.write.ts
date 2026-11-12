/**
 * AI Assistant — yozish tool’lari (2-etap: preview → confirm).
 *
 * Bu tool’lar `ai.confirm` orqali bajariladi. `preview` faqat ko‘rsatish uchun;
 * yon ta’sir yo‘q.
 */
import { z } from "zod";
import { rawTable } from "./ai.format";
import { money, truncate } from "./ai.text";
import { pNum, pStr, stripInternal, type AiPreview, type AiToolSpec } from "./ai.tool";

const STAFF_CREATE_PATHS: Record<string, string> = {
  agent: "/agents",
  operator: "/operators",
  supervisor: "/supervisors",
  expeditor: "/expeditors",
  collector: "/collectors",
  auditor: "/auditors",
  skladchik: "/skladchik"
};

const STAFF_UPDATE_PATHS = STAFF_CREATE_PATHS;

const STAFF_CREATE_KEYS: Record<string, string> = {
  agent: "staff.agent.create",
  operator: "staff.sotrudniki.create",
  supervisor: "staff.supervayzer.create",
  expeditor: "staff.ekspeditor.create",
  collector: "staff.inkassator.create",
  auditor: "staff.auditor.create",
  skladchik: "staff.skladchik.create"
};

const STAFF_UPDATE_KEYS: Record<string, string> = {
  agent: "staff.agent.update",
  operator: "staff.sotrudniki.update",
  supervisor: "staff.supervayzer.update",
  expeditor: "staff.ekspeditor.update",
  collector: "staff.inkassator.update",
  auditor: "staff.auditor.update",
  skladchik: "staff.skladchik.update"
};

const CREATE_KEYS = Object.values(STAFF_CREATE_KEYS);
const UPDATE_KEYS = Object.values(STAFF_UPDATE_KEYS);

function previewRow(label: string, value: string): [string, string] {
  return [label, value];
}

function previewTable(title: string, summary: string, rows: Array<[string, string]>): AiPreview {
  return { title, summary, columns: ["Maydon", "Qiymat"], rows: rows.map(([a, b]) => [a, b]) };
}

function labelOf(params: Record<string, unknown>, key: string, fallback: string): string {
  return pStr(params, key) ?? fallback;
}

export const WRITE_TOOLS: AiToolSpec[] = [
  {
    id: "write.create_employee",
    kind: "write",
    domain: "staff",
    title: "Xodim qo‘shish",
    description: "Yangi agent/operator/ekspeditor va h.k. yaratish",
    method: "POST",
    anyOf: CREATE_KEYS,
    schema: z.object({
      staffKind: z.enum(["agent", "operator", "supervisor", "expeditor", "collector", "auditor", "skladchik"]).default("agent"),
      first_name: z.string().trim().min(1).max(120),
      last_name: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      login: z.string().trim().min(3).max(64),
      password: z.string().min(8).max(72),
      code: z.string().trim().max(40).optional()
    }),
    path: (p) => STAFF_CREATE_PATHS[pStr(p, "staffKind") ?? "agent"] ?? "/agents",
    body: (p) => {
      const clean = stripInternal(p);
      return {
        first_name: clean.first_name,
        last_name: clean.last_name ?? null,
        phone: clean.phone ?? null,
        login: clean.login,
        password: clean.password,
        code: clean.code ?? null
      };
    },
    preview: (p) =>
      previewTable("Yangi xodim", `${pStr(p, "staffKind") ?? "agent"} yaratiladi`, [
        previewRow("Lavozim", pStr(p, "staffKind") ?? "agent"),
        previewRow("F.I.SH", `${pStr(p, "first_name") ?? ""} ${pStr(p, "last_name") ?? ""}`.trim()),
        previewRow("Login", pStr(p, "login") ?? ""),
        previewRow("Parol", "••••••••"),
        previewRow("Telefon", pStr(p, "phone") ?? "—")
      ]),
    format: (payload) => {
      const row = (payload ?? {}) as Record<string, unknown>;
      return rawTable({
        title: "Xodim yaratildi",
        summary: `${row.name ?? row.login ?? "Xodim"} muvaffaqiyatli qo‘shildi`,
        columns: ["Nomi", "Login", "Rol"],
        rows: [[String(row.name ?? "—"), String(row.login ?? "—"), String(row.role ?? "—")]]
      });
    }
  },
  {
    id: "write.update_employee",
    kind: "write",
    domain: "staff",
    title: "Xodimni o‘zgartirish",
    description: "Xodim holatini/telefonini/loginini o‘zgartirish",
    method: "PATCH",
    anyOf: UPDATE_KEYS,
    schema: z.object({
      staffKind: z.enum(["agent", "operator", "supervisor", "expeditor", "collector", "auditor", "skladchik"]).default("agent"),
      user_id: z.coerce.number().int().positive(),
      is_active: z.boolean().optional(),
      phone: z.string().trim().max(40).optional(),
      code: z.string().trim().max(40).optional(),
      login: z.string().trim().min(3).max(64).optional()
    }),
    path: (p) => `${STAFF_UPDATE_PATHS[pStr(p, "staffKind") ?? "agent"] ?? "/agents"}/${pNum(p, "user_id")}`,
    body: (p) => {
      const clean = stripInternal(p);
      const body: Record<string, unknown> = {};
      if (clean.is_active !== undefined) body.is_active = clean.is_active;
      if (clean.phone !== undefined) body.phone = clean.phone;
      if (clean.code !== undefined) body.code = clean.code;
      if (clean.login !== undefined) body.login = clean.login;
      return body;
    },
    preview: (p) => {
      const rows: Array<[string, string]> = [
        previewRow("Xodim", labelOf(p, "_user_name", `#${pNum(p, "user_id") ?? "?"}`))
      ];
      if (p.is_active !== undefined) rows.push(previewRow("Yangi holat", p.is_active === true ? "Faol" : "Nofaol"));
      if (p.phone !== undefined) rows.push(previewRow("Telefon", String(p.phone)));
      if (p.login !== undefined) rows.push(previewRow("Login", String(p.login)));
      return previewTable("Xodim o‘zgaradi", "Tasdiqlangach saqlanadi", rows);
    },
    format: () =>
      rawTable({
        title: "Xodim yangilandi",
        summary: "O‘zgarishlar saqlandi",
        columns: ["Natija"],
        rows: [["Bajarildi"]]
      })
  },
  {
    id: "write.set_price",
    kind: "write",
    domain: "products",
    title: "Narx o‘zgartirish",
    description: "Mahsulot narxini belgilangan turi bo‘yicha o‘zgartirish",
    method: "PUT",
    anyOf: ["settings.tsena.update"],
    schema: z.object({
      product_id: z.coerce.number().int().positive(),
      price_type: z.string().trim().min(1).max(64).default("retail"),
      price: z.coerce.number().nonnegative()
    }),
    path: (p) => `/products/${pNum(p, "product_id")}/prices`,
    body: (p) => ({
      items: [{ price_type: pStr(p, "price_type") ?? "retail", price: pNum(p, "price") ?? 0 }]
    }),
    preview: (p) =>
      previewTable("Narx o‘zgaradi", "Tasdiqlangach yangi narx saqlanadi", [
        previewRow("Mahsulot", labelOf(p, "_product_name", `#${pNum(p, "product_id") ?? "?"}`)),
        previewRow("Narx turi", pStr(p, "price_type") ?? "retail"),
        previewRow("Eski narx", pStr(p, "_current_price") ? money(pStr(p, "_current_price")) : "—"),
        previewRow("Yangi narx", money(pNum(p, "price")))
      ]),
    format: () =>
      rawTable({
        title: "Narx yangilandi",
        summary: "Yangi narx saqlandi",
        columns: ["Natija"],
        rows: [["Bajarildi"]]
      })
  },
  {
    id: "write.create_client",
    kind: "write",
    domain: "clients",
    title: "Mijoz qo‘shish",
    description: "Yangi mijoz yaratish (telefon, hudud, koordinatalar majburiy)",
    method: "POST",
    anyOf: ["clients.klient.create"],
    schema: z.object({
      name: z.string().trim().min(3).max(255),
      phone: z.string().trim().min(5).max(80),
      region: z.string().trim().min(1).max(500),
      district: z.string().trim().max(500).optional(),
      city: z.string().trim().max(500).optional(),
      address: z.string().trim().max(2000).optional(),
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180)
    }),
    path: () => "/clients",
    body: (p) => stripInternal(p),
    preview: (p) =>
      previewTable("Yangi mijoz", "Tasdiqlangach mijoz yaratiladi", [
        previewRow("Nomi", pStr(p, "name") ?? ""),
        previewRow("Telefon", pStr(p, "phone") ?? ""),
        previewRow("Hudud", pStr(p, "region") ?? ""),
        previewRow("Manzil", pStr(p, "address") ?? "—"),
        previewRow("Koordinata", `${pNum(p, "latitude") ?? "?"}, ${pNum(p, "longitude") ?? "?"}`)
      ]),
    format: () =>
      rawTable({ title: "Mijoz yaratildi", summary: "Yangi mijoz qo‘shildi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.update_client",
    kind: "write",
    domain: "clients",
    title: "Mijozni o‘zgartirish",
    description: "Mijoz ma’lumotlari, telefoni yoki kredit limitini o‘zgartirish",
    method: "PATCH",
    anyOf: ["clients.klient.update"],
    schema: z.object({
      client_id: z.coerce.number().int().positive(),
      name: z.string().trim().min(1).max(255).optional(),
      phone: z.string().trim().max(80).optional(),
      address: z.string().trim().max(2000).optional(),
      credit_limit: z.coerce.number().nonnegative().optional()
    }),
    path: (p) => `/clients/${pNum(p, "client_id")}`,
    body: (p) => {
      const clean = stripInternal(p);
      delete clean.client_id;
      return clean;
    },
    preview: (p) => {
      const rows: Array<[string, string]> = [previewRow("Mijoz", labelOf(p, "_client_name", `#${pNum(p, "client_id") ?? "?"}`))];
      if (p.name !== undefined) rows.push(previewRow("Yangi nom", String(p.name)));
      if (p.phone !== undefined) rows.push(previewRow("Telefon", String(p.phone)));
      if (p.address !== undefined) rows.push(previewRow("Manzil", truncate(String(p.address), 80)));
      if (p.credit_limit !== undefined) rows.push(previewRow("Kredit limiti", money(pNum(p, "credit_limit"))));
      return previewTable("Mijoz o‘zgaradi", "Tasdiqlangach saqlanadi", rows);
    },
    format: () =>
      rawTable({ title: "Mijoz yangilandi", summary: "O‘zgarishlar saqlandi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.create_product",
    kind: "write",
    domain: "products",
    title: "Mahsulot qo‘shish",
    description: "Yangi mahsulot yaratish",
    method: "POST",
    anyOf: ["settings.tovar.create"],
    schema: z.object({
      sku: z.string().trim().min(1).max(64),
      name: z.string().trim().min(1).max(255),
      category_id: z.coerce.number().int().positive(),
      unit: z.string().trim().min(1).max(32).optional(),
      barcode: z.string().trim().max(64).optional()
    }),
    path: () => "/products",
    body: (p) => stripInternal(p),
    preview: (p) =>
      previewTable("Yangi mahsulot", "Tasdiqlangach mahsulot yaratiladi", [
        previewRow("SKU", pStr(p, "sku") ?? ""),
        previewRow("Nomi", pStr(p, "name") ?? ""),
        previewRow("Kategoriya", `#${pNum(p, "category_id") ?? "?"}`),
        previewRow("O‘lchov", pStr(p, "unit") ?? "dona")
      ]),
    format: () =>
      rawTable({ title: "Mahsulot yaratildi", summary: "Yangi mahsulot qo‘shildi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.update_settings",
    kind: "write",
    domain: "settings",
    title: "Kompaniya sozlamalari",
    description: "Kompaniya nomi, telefoni, manzili yoki vaqt mintaqasini o‘zgartirish",
    method: "PATCH",
    anyOf: ["settings.profil_kompanii.update", "settings.timezone.update"],
    schema: z.object({
      name: z.string().trim().min(1).max(255).optional(),
      phone: z.string().trim().max(500).optional(),
      address: z.string().trim().max(4000).optional(),
      timezone: z.string().trim().max(64).optional()
    }),
    path: () => "/settings/profile",
    body: (p) => stripInternal(p),
    preview: (p) => {
      const rows: Array<[string, string]> = [];
      if (p.name !== undefined) rows.push(previewRow("Kompaniya nomi", String(p.name)));
      if (p.phone !== undefined) rows.push(previewRow("Telefon", String(p.phone)));
      if (p.address !== undefined) rows.push(previewRow("Manzil", truncate(String(p.address), 80)));
      if (p.timezone !== undefined) rows.push(previewRow("Vaqt mintaqasi", String(p.timezone)));
      return previewTable("Sozlama o‘zgaradi", "Tasdiqlangach saqlanadi", rows.length ? rows : [previewRow("O‘zgarish", "—")]);
    },
    format: () =>
      rawTable({ title: "Sozlama yangilandi", summary: "O‘zgarishlar saqlandi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.create_task",
    kind: "write",
    domain: "tasks",
    title: "Vazifa berish",
    description: "Xodimga topshiriq yaratish",
    method: "POST",
    anyOf: ["staff.zadachi_spisok.create"],
    schema: z.object({
      title: z.string().trim().min(1).max(500),
      description: z.string().trim().max(4000).optional(),
      assignee_user_id: z.coerce.number().int().positive(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      due_at: z.string().trim().max(40).optional()
    }),
    path: () => "/tasks",
    body: (p) => {
      const clean = stripInternal(p);
      return {
        title: clean.title,
        description: clean.description ?? null,
        assignee_user_id: clean.assignee_user_id,
        priority: clean.priority ?? "normal",
        due_at: clean.due_at ?? null
      };
    },
    preview: (p) =>
      previewTable("Yangi vazifa", "Tasdiqlangach topshiriq yuboriladi", [
        previewRow("Sarlavha", pStr(p, "title") ?? ""),
        previewRow("Kimga", labelOf(p, "_assignee_name", `#${pNum(p, "assignee_user_id") ?? "?"}`)),
        previewRow("Muhimlik", pStr(p, "priority") ?? "normal"),
        previewRow("Muddat", pStr(p, "due_at") ?? "—")
      ]),
    format: () =>
      rawTable({ title: "Vazifa yaratildi", summary: "Topshiriq yuborildi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.update_product",
    kind: "write",
    domain: "products",
    title: "Mahsulotni yangilash",
    description: "Mahsulot nomini, SKU'ni, o'lchov birikagini yoki kategoriyasini o'zgartirish",
    method: "PATCH",
    anyOf: ["settings.tovar.update"],
    schema: z.object({
      product_id: z.coerce.number().int().positive(),
      sku: z.string().trim().max(64).optional(),
      name: z.string().trim().max(255).optional(),
      unit: z.string().trim().max(32).optional(),
      price: z.coerce.number().nonnegative().optional()
    }),
    path: (p) => `/products/${pNum(p, "product_id")}`,
    body: (p) => {
      const clean = stripInternal(p);
      delete clean.product_id;
      return clean;
    },
    preview: (p) => {
      const rows: Array<[string, string]> = [previewRow("Mahsulot", labelOf(p, "_product_name", `#${pNum(p, "product_id") ?? "?"}`))];
      if (p.sku !== undefined) rows.push(previewRow("Yangi SKU", String(p.sku)));
      if (p.name !== undefined) rows.push(previewRow("Yangi nomi", String(p.name)));
      if (p.unit !== undefined) rows.push(previewRow("O'lchov", String(p.unit)));
      if (p.price !== undefined) rows.push(previewRow("Narx", money(pNum(p, "price"))));
      return previewTable("Mahsulot o'zgaradi", "Tasdiqlangach saqlanadi", rows);
    },
    format: () =>
      rawTable({ title: "Mahsulot yangilandi", summary: "O'zgarishlar saqlandi", columns: ["Natija"], rows: [["Bajarildi"]] })
  },
  {
    id: "write.order_status",
    kind: "write",
    domain: "orders",
    title: "Buyurtma holatini o'zgartirish",
    description: "Buyurtma statusini yangilash (tasdiqlandi, yuborildi, bekor qilindi va h.k.)",
    method: "PATCH",
    anyOf: ["orders.zakaz.update"],
    schema: z.object({
      order_id: z.coerce.number().int().positive(),
      status: z.string().trim().min(1).max(40)
    }),
    path: (p) => `/orders/${pNum(p, "order_id")}`,
    body: (p) => {
      const clean = stripInternal(p);
      delete clean.order_id;
      return clean;
    },
    preview: (p) => {
      const rows: Array<[string, string]> = [previewRow("Buyurtma", labelOf(p, "_order_name", `#${pNum(p, "order_id") ?? "?"}`))];
      if (p.status !== undefined) rows.push(previewRow("Yangi holat", String(p.status)));
      return previewTable("Buyurtma holati o'zgaradi", "Tasdiqlangach saqlanadi", rows);
    },
    format: () =>
      rawTable({ title: "Buyurtma yangilandi", summary: "Holat yangilandi", columns: ["Natija"], rows: [["Bajarildi"]] })
  }
];
