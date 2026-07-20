/**
 * Markazlashgan ruxsat tekshiruvi (strukturali `<module>.<section>.<action>` kalitlar).
 *
 * Nega markazlashgan? 60+ route faylini tahrirlash o'rniga, bitta joyda
 * method + route pattern → kerakli ruxsat kalitlari (anyOf) jadvali.
 * Global `preHandler` hook: mos qoida topilsa, JWT bor foydalanuvchi uchun
 * `requireAnyPermission` mantiqi qo'llanadi (`admin` chetlab o'tadi).
 *
 * XAVFSIZLIK: faqat `RBAC_ENFORCE_PERMISSIONS=1` bo'lsa ishlaydi. Avval
 * `migrate-permissions-to-crud` + rol default'lari seed qilinishi kerak,
 * aks holda eski foydalanuvchilar 403 oladi.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "./rbac.service";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RoutePermissionRule = {
  methods: Method[];
  /** Fastify route pattern (`request.routerPath`) bo'yicha regex, masalan `/orders/:id`. */
  test: RegExp;
  /** Shu kalitlardan kamida bittasi bo'lsa — ruxsat. */
  anyOf: string[];
};

const READ: Method[] = ["GET"];
const WRITE: Method[] = ["POST", "PUT", "PATCH"];

function r(methods: Method[], test: RegExp, ...anyOf: string[]): RoutePermissionRule {
  return { methods, test, anyOf };
}

/**
 * Qoidalar TARTIBI muhim — birinchi mos kelgani ishlatiladi.
 * Maxsus (bulk/status) yo'llar umumiy yo'llardan OLDIN turishi kerak.
 */
const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  // ─────────── Заказы (orders) ───────────
  r(WRITE, /\/orders\/[^/]+\/approval(\/|$)/, "plans.ustanovka_planov.approve"),
  r(READ, /\/orders\/[^/]+\/approval(\/|$)/, "orders.zakaz.view"),
  r(WRITE, /\/orders\/bulk\/(status)$/, "orders.zakaz.status"),
  r(WRITE, /\/orders\/bulk\/(expeditor)$/, "orders.zakaz.assign"),
  r(WRITE, /\/orders\/bulk\/(nakladnoy)/, "orders.zakaz.copy"),
  r(WRITE, /\/orders\/bulk\/(consignment)$/, "orders.drugie_operacii.update"),
  r(WRITE, /\/orders\/:id\/status$/, "orders.zakaz.status"),
  r(WRITE, /\/orders\/:id\/milestone-at$/, "orders.zakaz.status"),
  r(["POST"], /\/orders$/, "orders.zakaz.create"),
  r(["PUT", "PATCH"], /\/orders\/:id(\/meta)?$/, "orders.zakaz.update"),
  r(["DELETE"], /\/orders\/:id$/, "orders.zakaz.delete"),
  r(READ, /\/orders(\/|$)/, "orders.zakaz.view"),

  // ─────────── Возвраты (returns) ───────────
  r(WRITE, /\/returns(\/|$)/, "orders.vozvrat.create", "orders.vozvrat.update"),
  r(READ, /\/returns(\/|$)/, "orders.vozvrat.view"),

  // ─────────── Склад (stock/warehouse) ───────────
  r(WRITE, /\/stock\/corrections/, "warehouse.korrektirovka.create", "warehouse.korrektirovka.update"),
  r(WRITE, /\/stock\/adjustment$/, "warehouse.korrektirovka.update"),
  r(READ, /\/stock\/correction/, "warehouse.korrektirovka.view"),
  r(WRITE, /\/stock\/import/, "warehouse.postuplenie.create", "warehouse.postuplenie.import"),
  r(READ, /\/stock\/balances\/export$/, "warehouse.ostatki.copy"),
  r(READ, /\/stock\/balances$/, "warehouse.ostatki.view"),
  r(READ, /\/stock\/by-date\/export$/, "warehouse.ostatki_na_datu.copy"),
  r(READ, /\/stock\/by-date$/, "warehouse.ostatki_na_datu.view"),
  r(READ, /\/stock\/recommended/, "warehouse.rekomendovannyy_zapas.view"),
  r(READ, /\/stock\/material-report/, "warehouse.materialnyy_otchet.view"),
  r(READ, /\/stock\/receipts-report/, "warehouse.postuplenie.view"),
  r(READ, /\/stock\/receipts$/, "warehouse.postuplenie.view"),
  r(READ, /\/stock(\/|$)/, "warehouse.ostatki.view"),
  r(WRITE, /\/goods-receipts\/:id\/status$/, "warehouse.postuplenie.status"),
  r(["POST"], /\/goods-receipts$/, "warehouse.postuplenie.create"),
  r(["PUT", "PATCH"], /\/goods-receipts\/:id$/, "warehouse.postuplenie.update"),
  r(["DELETE"], /\/goods-receipts\/:id$/, "warehouse.postuplenie.delete"),
  r(READ, /\/goods-receipts(\/|$)/, "warehouse.postuplenie.view"),
  r(WRITE, /\/warehouse-transfers/, "warehouse.peremeshchenie.create", "warehouse.peremeshchenie.transfer", "warehouse.peremeshchenie.update"),
  r(READ, /\/warehouse-transfers/, "warehouse.peremeshchenie.view"),
  r(WRITE, /\/warehouse-blocks/, "warehouse.bloki.create", "warehouse.bloki.update", "warehouse.bloki.delete"),
  r(READ, /\/warehouse-blocks/, "warehouse.bloki.view"),
  r(WRITE, /\/stock-takes/, "warehouse.korrektirovka.create", "warehouse.korrektirovka.update"),
  r(READ, /\/stock-takes/, "warehouse.korrektirovka.view"),
  r(WRITE, /\/warehouses(\/|$)/, "warehouse.sklady.create", "warehouse.sklady.update", "warehouse.sklady.delete"),
  r(READ, /\/warehouses(\/|$)/, "warehouse.sklady.view"),

  // ─────────── Касса (payments / cash-desks / currency / expenses) ───────────
  r(WRITE, /\/payments\/:id\/(confirm|batch-confirm)$/, "cash.oplaty_klientov.update"),
  r(WRITE, /\/payments\/:id\/(reject|return-to-expeditor)$/, "cash.oplaty_klientov.update"),
  r(["POST"], /\/payments(\/order-cash-in)?$/, "cash.oplaty_klientov.create"),
  r(["PUT", "PATCH"], /\/payments\/:id/, "cash.oplaty_klientov.update"),
  r(["DELETE"], /\/payments\/:id$/, "cash.oplaty_klientov.delete"),
  r(READ, /\/payments(\/|$)/, "cash.oplaty_klientov.view"),
  r(WRITE, /\/cash-desks\/:id\/shifts\/:shiftId\/close$/, "cash.kassa.status"),
  r(["POST"], /\/cash-desks(\/|$)/, "cash.kassa.create"),
  r(["PUT", "PATCH"], /\/cash-desks\/:id$/, "cash.kassa.create"),
  r(READ, /\/cash-desks(\/|$)/, "cash.kassa.view"),
  r(WRITE, /\/currency-rates/, "cash.kurs_valyuty.create", "cash.kurs_valyuty.update"),
  r(READ, /\/currency-rates/, "cash.kurs_valyuty.view"),
  r(WRITE, /\/expenses\/:id\/(approve|reject)$/, "cash.zayavki_na_oplatu.approve"),
  r(["POST"], /\/expenses$/, "cash.rashody_klienta.create"),
  r(["PUT", "PATCH"], /\/expenses\/:id$/, "cash.rashody_klienta.update"),
  r(["DELETE"], /\/expenses\/:id$/, "cash.rashody_klienta.delete"),
  r(READ, /\/expenses(\/|$)/, "cash.rashody_klienta.view"),
  r(READ, /\/client-balances(\/|$)/, "cash.otchety.view"),
  r(WRITE, /\/opening-balances/, "cash.nachalnye_balansy.create", "cash.nachalnye_balansy.update"),
  r(READ, /\/opening-balances/, "cash.nachalnye_balansy.view"),

  // ─────────── Поставщики (suppliers) ───────────
  r(WRITE, /\/suppliers\/accounting\/payments/, "suppliers.oplaty.create", "suppliers.oplaty.update"),
  r(READ, /\/suppliers\/accounting\/(balances|reconciliation)/, "suppliers.balansy.view"),
  r(READ, /\/suppliers\/accounting\/payments/, "suppliers.oplaty.view"),
  r(["POST"], /\/suppliers$/, "suppliers.postavshchik.create"),
  r(["PUT", "PATCH"], /\/suppliers\/:id$/, "suppliers.postavshchik.update"),
  r(["DELETE"], /\/suppliers\/:id$/, "suppliers.postavshchik.delete"),
  r(READ, /\/suppliers(\/|$)/, "suppliers.postavshchik.view"),

  // ─────────── Клиенты (clients) ───────────
  r(WRITE, /\/clients\/bulk-active$/, "clients.klient.activate", "clients.klient.deactivate"),
  r(WRITE, /\/clients\/bulk$/, "clients.klient.update", "clients.klient.assign"),
  r(WRITE, /\/clients\/bulk-tags$/, "clients.klient.update", "clients.klient.assign"),
  r(WRITE, /\/clients\/tags$/, "clients.klient.update", "clients.klient.assign"),
  r(WRITE, /\/clients\/import/, "clients.klient.import"),
  r(READ, /\/clients\/export$/, "clients.klient.copy"),
  r(WRITE, /\/clients\/:id\/equipment/, "clients.oborudovanie.create", "clients.oborudovanie.update", "clients.oborudovanie.delete"),
  r(READ, /\/clients\/:id\/equipment/, "clients.oborudovanie.view"),
  r(["POST"], /\/clients$/, "clients.klient.create"),
  r(["PUT", "PATCH"], /\/clients\/:id$/, "clients.klient.update"),
  r(["DELETE"], /\/clients\/:id$/, "clients.klient.delete"),
  r(READ, /\/clients(\/|$)/, "clients.klient.view"),

  // ─────────── Накладные / списания (assembly via returns write-offs) ───────────
  r(WRITE, /\/order-automation/, "automation.zaiavki.create", "automation.zaiavki.update"),
  r(READ, /\/order-automation/, "automation.zaiavki.view"),

  // ─────────── Настройки: Товар / Цена (products) ───────────
  r(WRITE, /\/products\/(import|import-catalog)/, "settings.tovar.import"),
  r(READ, /\/products\/export-catalog/, "settings.tovar.copy"),
  r(WRITE, /\/products\/prices\/import/, "settings.tsena.import", "settings.tsena.create"),
  r(WRITE, /\/products\/prices\/matrix$/, "settings.tsena.update"),
  r(WRITE, /\/products\/:id\/prices$/, "settings.tsena.update"),
  r(READ, /\/products\/:id\/prices$/, "settings.tsena.view"),
  r(READ, /\/product-prices/, "settings.tsena.view"),
  r(WRITE, /\/products\/bulk$/, "settings.tovar.update"),
  r(["POST"], /\/products$/, "settings.tovar.create"),
  r(["PUT", "PATCH"], /\/products\/:id$/, "settings.tovar.update"),
  r(["DELETE"], /\/products\/:id$/, "settings.tovar.delete"),
  r(READ, /\/products(\/|$)/, "settings.tovar.view"),
  r(WRITE, /\/settings\/profile$/, "settings.profil_kompanii.update"),
  r(READ, /\/settings\/profile$/, "settings.profil_kompanii.view"),
  r(WRITE, /\/system-migration\/import/, "settings.profil_kompanii.update"),
  r(READ, /\/system-migration(\/|$)/, "settings.profil_kompanii.view"),

  // ─────────── Пользователи (staff) ───────────
  r(WRITE, /\/skladchik\/.*\/(activate|deactivate|aktivnost)/, "staff.skladchik.activate", "staff.skladchik.deactivate"),
  r(["POST"], /\/skladchik(\/|$)/, "staff.skladchik.create"),
  r(["PUT", "PATCH"], /\/skladchik\//, "staff.skladchik.update"),
  r(["DELETE"], /\/skladchik\//, "staff.skladchik.update"),
  r(READ, /\/skladchik(\/|$)/, "staff.skladchik.view"),
  r(WRITE, /\/agents\/.*\/(activate|deactivate|aktivnost)/, "staff.agent.activate", "staff.agent.deactivate"),
  r(["POST"], /\/agents(\/|$)/, "staff.agent.create"),
  r(["PUT", "PATCH"], /\/agents\//, "staff.agent.update"),
  r(["DELETE"], /\/agents\//, "staff.agent.delete"),
  r(READ, /\/agents(\/|$)/, "staff.agent.view"),
  r(WRITE, /\/staff\/.*\/(activate|deactivate|aktivnost)/, "staff.agent.activate", "staff.agent.deactivate"),
  r(["POST"], /\/staff\//, "staff.agent.create"),
  r(["PUT", "PATCH"], /\/staff\//, "staff.agent.update"),
  r(["DELETE"], /\/staff\//, "staff.agent.delete"),
  r(READ, /\/staff(\/|$)/, "staff.agent.view"),

  // ─────────── Табель / Рабочее место ───────────
  r(WRITE, /\/timesheet/, "staff.tabel.create", "staff.tabel.update"),
  r(READ, /\/timesheet/, "staff.tabel.view"),
  r(WRITE, /\/workdays/, "staff.tabel.create", "staff.tabel.update"),
  r(READ, /\/workdays/, "staff.tabel.view"),
  r(READ, /\/tabel-audit/, "staff.tabel.view"),
  r(WRITE, /\/work-slots\/.*\/(assign|unassign)/, "work_slots.raboche_mesto.assign", "work_slots.raboche_mesto.update"),
  r(WRITE, /\/work-slots/, "work_slots.raboche_mesto.create", "work_slots.raboche_mesto.update", "work_slots.raboche_mesto.assign"),
  r(READ, /\/work-slots/, "work_slots.raboche_mesto.view"),
  r(WRITE, /\/client-agent-assignments/, "work_slots.raboche_mesto.assign", "work_slots.raboche_mesto.update"),
  r(READ, /\/client-agent-assignments/, "work_slots.raboche_mesto.view"),

  // ─────────── Консигнация ───────────
  r(WRITE, /\/consignment/, "staff.konsignatsiya.update", "staff.konsignatsiya.create", "clients.klient.update"),
  r(READ, /\/consignment/, "staff.konsignatsiya.view", "clients.klient.view"),

  // ─────────── Планы → Настройка утверждающих ───────────
  r(WRITE, /\/plans\/approvers/, "plans.nastroyka_utverzhdayushchih.update"),
  r(READ, /\/plans\/approvers/, "plans.nastroyka_utverzhdayushchih.view"),

  // ─────────── Планы → Установка планов / Kunlik KPI ───────────
  r(["POST"], /\/plans\/setup\/confirm$/, "plans.ustanovka_planov.update"),
  r(["POST"], /\/plans\/setup\/approve$/, "plans.ustanovka_planov.approve"),
  r(["POST"], /\/plans\/setup\/return$/, "plans.ustanovka_planov.approve"),
  r(WRITE, /\/plans\/setup/, "plans.ustanovka_planov.update", "plans.ustanovka_planov.create"),
  r(READ, /\/plans\/setup/, "plans.ustanovka_planov.view"),
  r(READ, /\/plans\/daily-kpi/, "plans.ustanovka_planov.view"),

  // ─────────── Dashboard ───────────
  r(READ, /\/dashboard\/sales-monitoring/, "dashboard.prodazhi.view"),
  r(READ, /\/dashboard\/sales/, "dashboard.prodazhi.view"),
  r(READ, /\/dashboard\/finance/, "dashboard.finansy.view"),
  r(READ, /\/dashboard\/supervisor/, "dashboard.supervayzer.view"),
  r(READ, /\/dashboard(\/|$)/, "dashboard.prodazhi.view"),

  // ─────────── Отчёты ───────────
  r(READ, /\/reports\/.*\/export/, "reports.otchety.copy", "reports.konstruktor.copy"),
  r(
    WRITE,
    /\/reports\/builder/,
    "reports.konstruktor.create",
    "reports.konstruktor.update",
    "reports.otchety.create",
    "reports.otchety.update"
  ),
  r(READ, /\/reports\/builder/, "reports.konstruktor.view", "reports.otchety.view", "pivot.otchety.view"),
  r(READ, /\/reports(\/|$)/, "reports.otchety.view", "reports.konstruktor.view"),

  // ─────────── Бонусы и скидки (bonus-rules) ───────────
  r(WRITE, /\/bonus-rules\/bulk$/, "settings.bonusy_i_skidki.update"),
  r(WRITE, /\/bonus-rules\/:id\/active$/, "settings.bonusy_i_skidki.update"),
  r(WRITE, /\/bonus-rules\/:id\/order-scope$/, "settings.bonusy_i_skidki.update"),
  r(["POST"], /\/bonus-rules$/, "settings.bonusy_i_skidki.create"),
  r(["PUT", "PATCH"], /\/bonus-rules\/:id$/, "settings.bonusy_i_skidki.update"),
  r(["DELETE"], /\/bonus-rules\/:id$/, "settings.bonusy_i_skidki.delete"),
  r(READ, /\/bonus-rules(\/|$)/, "settings.bonusy_i_skidki.view"),

  // ─────────── Отказы (refusals) ───────────
  r(WRITE, /\/refusals(\/|$)/, "orders.obmen_i_otkaz.create", "orders.obmen_i_otkaz.update"),
  r(READ, /\/refusals(\/|$)/, "orders.obmen_i_otkaz.view"),

  // ─────────── Аудит ───────────
  r(READ, /\/audit-events(\/|$)/, "audit.log.view"),

  // ─────────── Диагностика (xatolik loglari) ───────────
  r(READ, /\/error-events(\/|$)/, "diagnostics.error_logs.view"),

  // ─────────── Доступ (access workspace) ───────────
  r(WRITE, /\/access\/(users|role-defaults|users-bulk)/, "access.upravlenie.update"),
  r(READ, /\/access\/(users|role-defaults|history|permissions|dimensions|territories)(\/|$)/, "access.upravlenie.view"),

  // ─────────── Справочники / территория / направления ───────────
  r(WRITE, /\/territory(\/|$)/, "settings.territoriya.create", "settings.territoriya.update", "settings.territoriya.delete"),
  r(READ, /\/territory(\/|$)/, "settings.territoriya.view"),
  r(WRITE, /\/sales-directions(\/|$)/, "settings.napravlenie_torgovli.create", "settings.napravlenie_torgovli.update", "settings.napravlenie_torgovli.delete"),
  r(READ, /\/sales-directions(\/|$)/, "settings.napravlenie_torgovli.view"),
  r(WRITE, /\/reference(\/|$)/, "settings.tovar.update"),
  r(READ, /\/reference(\/|$)/, "settings.tovar.view"),

  // ─────────── Связи (linkage) ───────────
  r(WRITE, /\/linkage(\/|$)/, "clients.klient.assign", "clients.klient.update"),
  r(READ, /\/linkage(\/|$)/, "clients.klient.view"),

  // ─────────── Полевые / GPS / маршруты ───────────
  r(WRITE, /\/field(\/|$)/, "gps.gps.update", "routes.marshruty.update"),
  r(READ, /\/field(\/|$)/, "gps.gps.view", "routes.marshruty.view"),
  r(WRITE, /\/geo-boundaries(\/|$)/, "clients.klient.assign", "clients.klient.update"),
  r(READ, /\/geo-boundaries(\/|$)/, "clients.klient.view"),

  // ─────────── Уведомления ───────────
  r(WRITE, /\/notifications(\/|$)/, "staff.zadachi.update"),
  r(READ, /\/notifications(\/|$)/, "staff.zadachi.view")
];

function matchRule(method: string, routePath: string): RoutePermissionRule | null {
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (!rule.methods.includes(method as Method)) continue;
    if (rule.test.test(routePath)) return rule;
  }
  return null;
}

/** Test/diagnostika uchun eksport. */
export { ROUTE_PERMISSION_RULES, matchRule };

export function registerRoutePermissionGuard(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (env.RBAC_ENFORCE_PERMISSIONS !== "1") return;

    const method = request.method.toUpperCase();
    const routePath = (request as { routerPath?: string }).routerPath ?? request.url.split("?")[0] ?? "";
    if (!routePath.startsWith("/api/")) return;

    const rule = matchRule(method, routePath);
    if (!rule) return;

    // JWT bo'lmasa — route o'z guardida 401 beradi; bu yerda chetlab o'tamiz.
    let user: ReturnType<typeof getAccessUser> | null = null;
    try {
      await request.jwtVerify();
      user = getAccessUser(request);
    } catch {
      return;
    }
    if (!user) return;
    if (user.role === "admin") return; // admin chetlab o'tadi

    const userId = Number(user.sub);
    if (!Number.isInteger(userId) || userId < 1) return;

    const effective = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
    if (!rule.anyOf.some((k) => effective.has(k))) {
      return sendApiError(reply, request, 403, "ForbiddenPermission", undefined, { permissions: rule.anyOf });
    }
  });
}
