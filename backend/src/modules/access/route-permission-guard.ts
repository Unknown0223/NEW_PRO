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
import { ORDER_STATUS_CHANGE_PERMISSIONS, ORDER_STATUS_DATE_PERMISSION } from "../orders/order-status-permissions";
import {
  ORDER_CREATE_ANY_PERMISSIONS,
  ORDER_CREATE_PERMISSION,
  ORDER_EXCHANGE_PERMISSION,
  RETURN_BY_ORDER_PERMISSION,
  RETURN_CREATE_ANY_PERMISSIONS,
  RETURN_SHELF_PERMISSION
} from "../orders/order-create-permissions";
import { PAYROLL_ROUTE_PERMISSION_RULES } from "./route-permission-guard.payroll";
import { CLIENT_BULK_PATCH_PERMISSIONS, CLIENT_GROUP_TAGS_PERMISSION } from "../clients/client-bulk-permissions";
import { GPS_MONITORING_VIEW_PERMISSIONS } from "../gps-monitoring/gps-monitoring.access";
import {
  REPORT_GROUP_EXPORT_PERMISSIONS,
  REPORT_GROUP_VIEW_PERMISSIONS,
  REPORT_PAGE_PERMISSIONS
} from "../reports/report-permissions";

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
const DEL: Method[] = ["DELETE"];

function r(methods: Method[], test: RegExp, ...anyOf: string[]): RoutePermissionRule {
  return { methods, test, anyOf };
}

/**
 * Qoidalar TARTIBI muhim — birinchi mos kelgani ishlatiladi.
 * Maxsus (bulk/status) yo'llar umumiy yo'llardan OLDIN turishi kerak.
 */
const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  ...PAYROLL_ROUTE_PERMISSION_RULES,
  // ─────────── Заказы (orders) ───────────
  r(WRITE, /\/orders\/[^/]+\/approval(\/|$)/, "plans.ustanovka_planov.approve"),
  r(READ, /\/orders\/[^/]+\/approval(\/|$)/, "orders.zakaz.view"),
  // Status: guard — kamida bitta status kaliti; aniq o'tish (`from → to`) servisda tekshiriladi.
  r(WRITE, /\/orders\/bulk\/(status)$/, ...ORDER_STATUS_CHANGE_PERMISSIONS),
  r(["POST"], /\/orders\/bulk\/details$/, "orders.zakaz.view"),
  r(WRITE, /\/orders\/bulk\/(expeditor)$/, "orders.zakaz.assign"),
  r(WRITE, /\/orders\/bulk\/(nakladnoy)/, "orders.zakaz.copy"),
  r(WRITE, /\/orders\/bulk\/(consignment)$/, "orders.drugie_operacii.update"),
  r(WRITE, /\/orders\/bulk\/(bonus-refresh)$/, "orders.zakaz.update"),
  r(WRITE, /\/orders\/:id\/status$/, ...ORDER_STATUS_CHANGE_PERMISSIONS),
  r(WRITE, /\/orders\/:id\/milestone-at$/, ORDER_STATUS_DATE_PERMISSION),
  r(["POST"], /\/orders\/bonus-preview$/, "orders.zakaz.update", ORDER_CREATE_PERMISSION),
  // Yaratish: kamida bitta yaratish kaliti; aniq tur (`order_type`) handlerda tekshiriladi.
  r(["POST"], /\/orders$/, ...ORDER_CREATE_ANY_PERMISSIONS),
  r(["PUT", "PATCH"], /\/orders\/:id(\/meta)?$/, "orders.zakaz.update"),
  // Yaratish sahifalari ma'lumotlari — «Заявки» ro'yxatini ko'rish ruxsatisiz ham ochiladi.
  r(READ, /\/orders\/(create-context|create-catalog|prices-as-of)$/, "orders.zakaz.view", ...ORDER_CREATE_ANY_PERMISSIONS),
  r(READ, /\/orders\/exchange-source-availability$/, "orders.zakaz.view", ORDER_EXCHANGE_PERMISSION),
  // «По заказу» va «Обмен» — mijozning zakazlarini tanlash uchun ro'yxat.
  r(READ, /\/orders$/, "orders.zakaz.view", RETURN_BY_ORDER_PERMISSION, ORDER_EXCHANGE_PERMISSION),
  r(READ, /\/orders(\/|$)/, "orders.zakaz.view"),

  // ─────────── Возвраты (returns) ───────────
  // Qabul qilish — «Накладные → Возвратные накладные».
  r(["POST"], /\/returns\/daily-waybills\/[^/]+\/[^/]+\/accept$/, "invoices.vozvratnye.approve"),
  r(["POST"], /\/returns\/:id\/(accept|reject)$/, "invoices.vozvratnye.approve"),
  r(READ, /\/returns\/daily-waybills(\/|$)/, "invoices.vozvratnye.view"),
  r(["POST"], /\/returns\/period-batch$/, RETURN_SHELF_PERMISSION),
  r(["POST"], /\/returns\/full-order$/, RETURN_BY_ORDER_PERMISSION),
  // `/returns/period` va `/returns`: «с полки» yoki «по заказу» (`order_id`) handlerda.
  r(WRITE, /\/returns(\/|$)/, ...RETURN_CREATE_ANY_PERMISSIONS),
  r(READ, /\/returns\/shelf-return-by-order\/check$/, RETURN_BY_ORDER_PERMISSION),
  r(READ, /\/returns\/(client-data|order-balances)$/, ...RETURN_CREATE_ANY_PERMISSIONS, ORDER_EXCHANGE_PERMISSION),
  r(READ, /\/returns(\/|$)/, "invoices.vozvratnye.view", ...RETURN_CREATE_ANY_PERMISSIONS),

  // ─────────── Склад (stock/warehouse) ───────────
  r(WRITE, /\/stock\/corrections/, "warehouse.korrektirovka.create", "warehouse.korrektirovka.update"),
  r(WRITE, /\/stock\/adjustment$/, "warehouse.korrektirovka.update"),
  r(READ, /\/stock\/correction/, "warehouse.korrektirovka.view"),
  r(WRITE, /\/stock\/import/, "warehouse.postuplenie.create", "warehouse.postuplenie.import"),
  r(READ, /\/stock\/balances\/export$/, "warehouse.ostatki.copy"),
  r(READ, /\/stock\/balances$/, "warehouse.ostatki.view"),
  r(READ, /\/stock\/by-date\/export$/, "warehouse.ostatki_na_datu.copy"),
  r(READ, /\/stock\/by-date$/, "warehouse.ostatki_na_datu.view"),
  r(READ, /\/stock\/recommended\/export$/, "warehouse.rekomendovannyy_zapas.export"),
  r(READ, /\/stock\/material-report\/export$/, "warehouse.materialnyy_otchet.export"),
  r(READ, /\/stock\/receipts-report\/export$/, "warehouse.postuplenie.export"),
  r(READ, /\/stock\/recommended/, "warehouse.rekomendovannyy_zapas.view"),
  r(READ, /\/stock\/material-report/, "warehouse.materialnyy_otchet.view"),
  r(READ, /\/stock\/receipts-report/, "warehouse.postuplenie.view"),
  r(["POST"], /\/stock\/receipts$/, "warehouse.postuplenie.create"),
  r(READ, /\/stock\/receipts$/, "warehouse.postuplenie.view"),
  r(READ, /\/stock(\/|$)/, "warehouse.ostatki.view"),
  r(WRITE, /\/goods-receipts\/:id\/status$/, "warehouse.postuplenie.status"),
  r(["POST"], /\/goods-receipts\/:id\/restore$/, "warehouse.postuplenie.delete"),
  r(["POST"], /\/goods-receipts$/, "warehouse.postuplenie.create"),
  r(["PUT", "PATCH"], /\/goods-receipts\/:id$/, "warehouse.postuplenie.update"),
  r(["DELETE"], /\/goods-receipts\/:id$/, "warehouse.postuplenie.delete"),
  r(READ, /\/goods-receipts(\/|$)/, "warehouse.postuplenie.view"),
  // Peremeshchenie API: `/transfers` (eski nom `/warehouse-transfers` ham).
  r(["POST"], /\/(warehouse-)?transfers$/, "warehouse.peremeshchenie.create"),
  r(["POST"], /\/(warehouse-)?transfers\/:id\/(start|receive)$/, "warehouse.peremeshchenie.transfer"),
  r(["POST"], /\/(warehouse-)?transfers\/:id\/cancel$/, "warehouse.peremeshchenie.update", "warehouse.peremeshchenie.transfer"),
  r(["PUT", "PATCH"], /\/(warehouse-)?transfers\/:id$/, "warehouse.peremeshchenie.update"),
  r(WRITE, /\/warehouse-transfers/, "warehouse.peremeshchenie.create", "warehouse.peremeshchenie.transfer", "warehouse.peremeshchenie.update"),
  r(READ, /\/warehouse-transfers/, "warehouse.peremeshchenie.view"),
  r(WRITE, /\/warehouse-blocks/, "warehouse.bloki.create", "warehouse.bloki.update", "warehouse.bloki.delete"),
  r(DEL, /\/warehouse-blocks/, "warehouse.bloki.delete"),
  r(READ, /\/warehouse-blocks\/export$/, "warehouse.bloki.export"),
  r(READ, /\/warehouse-blocks/, "warehouse.bloki.view"),
  r(WRITE, /\/stock-takes/, "warehouse.korrektirovka.create", "warehouse.korrektirovka.update"),
  r(READ, /\/stock-takes/, "warehouse.korrektirovka.view"),
  r(DEL, /\/warehouses\/:id$/, "warehouse.sklady.deactivate"),
  r(["POST"], /\/warehouses\/:id\/restore$/, "warehouse.sklady.activate"),
  r(["POST"], /\/warehouses$/, "warehouse.sklady.create"),
  r(
    WRITE,
    /\/warehouses(\/|$)/,
    "warehouse.sklady.update",
    "warehouse.sklady.activate",
    "warehouse.sklady.deactivate"
  ),
  r(
    READ,
    /\/warehouses(\/|$)/,
    "warehouse.sklady.view",
    "warehouse.ostatki.view",
    "warehouse.ostatki_na_datu.view",
    "warehouse.rekomendovannyy_zapas.view",
    "warehouse.materialnyy_otchet.view",
    "warehouse.postuplenie.view",
    "warehouse.peremeshchenie.view",
    "warehouse.bloki.view",
    "warehouse.korrektirovka.view"
  ),

  // ─────────── Оплата поставщику — kassa `/payments` qoidalaridan OLDIN ───────────
  r(WRITE, /\/suppliers\/accounting\/payments/, "suppliers.oplaty.create", "suppliers.oplaty.update"),
  r(DEL, /\/suppliers\/accounting\/payments/, "suppliers.oplaty.update"),
  r(READ, /\/suppliers\/accounting\/payments/, "suppliers.oplaty.view"),

  // ─────────── Касса (payments / cash-desks / currency / expenses) ───────────
  r(WRITE, /\/bank-transfer-inbox\/(ingest|import|manual)$/, "cash.perechisleniya.import", "cash.perechisleniya.create"),
  r(WRITE, /\/bank-transfer-inbox\/:id\/(assign|reassign|comment|ignore|create-payment)$/, "cash.perechisleniya.update"),
  r(READ, /\/bank-transfer-inbox(\/|$)/, "cash.perechisleniya.view"),
  r(WRITE, /\/payments\/:id\/(confirm|reject|return-to-expeditor)$/, "cash.oplaty_klientov.approve"),
  r(["POST"], /\/payments\/batch-(confirm|reject|return-to-expeditor)$/, "cash.oplaty_klientov.approve"),
  r(WRITE, /\/payments\/:id\/(allocate|edit-grants)$/, "cash.oplaty_klientov.update"),
  r(["POST"], /\/payments\/(batch-delete|batch-restore|:id\/restore)$/, "cash.oplaty_klientov.delete"),
  r(["POST"], /\/payments\/by-ids$/, "cash.oplaty_klientov.view"),
  r(["POST"], /\/payments(\/order-cash-in)?$/, "cash.oplaty_klientov.create"),
  r(["PUT", "PATCH"], /\/payments\/:id/, "cash.oplaty_klientov.update"),
  r(["DELETE"], /\/payments\/:id$/, "cash.oplaty_klientov.delete"),
  r(READ, /\/payments(\/|$)/, "cash.oplaty_klientov.view"),
  r(WRITE, /\/cash-desks\/[^/]+\/shifts\/(open|[^/]+\/close)$/, "cash.kassa.status"),
  r(["POST"], /\/cash-desks$/, "cash.kassa.create"),
  r(["PUT", "PATCH"], /\/cash-desks\/:id$/, "cash.kassa.update"),
  r(READ, /\/cash-desks(\/|$)/, "cash.kassa.view"),
  r(WRITE, /\/currency-rates/, "cash.kurs_valyuty.create", "cash.kurs_valyuty.update"),
  r(DEL, /\/currency-rates/, "cash.kurs_valyuty.update"),
  r(READ, /\/currency-rates/, "cash.kurs_valyuty.view"),
  r(WRITE, /\/expenses\/:id\/(approve|reject)$/, "cash.zayavki_na_oplatu.approve"),
  r(["POST"], /\/expenses\/:id\/restore$/, "cash.rashody_klienta.delete"),
  r(["POST"], /\/expenses$/, "cash.rashody_klienta.create"),
  r(["PUT", "PATCH"], /\/expenses\/:id$/, "cash.rashody_klienta.update"),
  r(["DELETE"], /\/expenses\/:id$/, "cash.rashody_klienta.delete"),
  r(READ, /\/expenses(\/|$)/, "cash.rashody_klienta.view"),
  // Balanslar: yangi `balansy_klientov`; `otchety.view` — eski grantlar uchun moslik.
  r(READ, /\/client-balances(\/|$)/, "cash.balansy_klientov.view", "cash.otchety.view", "cash.otchety.spisok_balansy_klientov", "cash.otchety.spisok_balansy_klientov_po_konsignatsii", "cash.otchety.detal_balans_klienta", "cash.otchety.detal_balans_klienta_po_konsignatsii", "cash.balansy.view"),
  r(WRITE, /\/opening-balances/, "cash.nachalnye_balansy.create", "cash.nachalnye_balansy.update", "cash.nachalnye_balansy.void", "cash.nachalnye_balansy.restore"),
  r(DEL, /\/opening-balances/, "cash.nachalnye_balansy.void"),
  r(READ, /\/opening-balances/, "cash.nachalnye_balansy.view", "cash.nachalnye_balansy_klientov.view", "cash.nachalnye_balansy_klientov.spisok_nachalnye_balansy"),

  // ─────────── Поставщики (suppliers) ───────────
  r(READ, /\/suppliers\/accounting\/(balances|reconciliation)/, "suppliers.balansy.view"),
  r(["POST"], /\/suppliers\/:id\/restore$/, "suppliers.postavshchik.delete"),
  r(["POST"], /\/suppliers$/, "suppliers.postavshchik.create"),
  r(["PUT", "PATCH"], /\/suppliers\/:id$/, "suppliers.postavshchik.update"),
  r(["DELETE"], /\/suppliers\/:id$/, "suppliers.postavshchik.delete"),
  r(READ, /\/suppliers(\/|$)/, "suppliers.postavshchik.view"),

  // ─────────── Клиенты (clients) ───────────
  // Ommaviy tahrir: handler har bir maydon guruhini alohida tekshiradi (`clients/client-bulk-rbac.ts`).
  r(WRITE, /\/clients\/bulk-active$/, "clients.klient.activate", "clients.klient.deactivate"),
  r(WRITE, /\/clients\/(bulk|bulk-items)$/, ...CLIENT_BULK_PATCH_PERMISSIONS),
  r(WRITE, /\/clients\/bulk-tags$/, CLIENT_GROUP_TAGS_PERMISSION),
  r(WRITE, /\/clients\/tags$/, CLIENT_GROUP_TAGS_PERMISSION, "clients.klient.update"),
  r(["POST"], /\/clients\/merge-preview$/, "clients.obedinenie.view"),
  r(["POST"], /\/clients\/merge$/, "clients.obedinenie.update"),
  r(["POST"], /\/clients\/saved-duplicate-groups\/:id\/restore$/, "clients.obedinenie.restore"),
  r(["POST"], /\/clients\/saved-duplicate-groups$/, "clients.obedinenie.create"),
  r(DEL, /\/clients\/saved-duplicate-groups\/:id$/, "clients.obedinenie.delete"),
  r(READ, /\/clients\/saved-duplicate-groups$/, "clients.obedinenie.view"),
  r(READ, /\/clients\/(merge-history|merge-sessions)$/, "clients.obedinenie.history"),
  r(WRITE, /\/clients\/import/, "clients.klient.import"),
  r(READ, /\/clients\/export$/, "clients.klient.copy"),
  r(["POST"], /\/clients\/:id\/equipment\/:id\/remove$/, "clients.oborudovanie.delete"),
  r(["POST"], /\/clients\/:id\/equipment$/, "clients.oborudovanie.create"),
  r(READ, /\/clients\/:id\/equipment/, "clients.oborudovanie.view"),
  r(READ, /\/:slug\/equipment$/, "clients.oborudovanie.view"),
  r(["POST"], /\/clients$/, "clients.klient.create"),
  r(["PUT", "PATCH"], /\/clients\/:id$/, "clients.klient.update"),
  r(WRITE, /\/clients\/:id\/photo-reports\/[^/]+\/restore/, "clients.foto.restore"),
  r(["DELETE"], /\/clients\/:id\/photo-reports/, "clients.foto.void"),
  r(["POST"], /\/clients\/:id\/photo-reports/, "clients.foto.create"),
  r(READ, /\/clients\/:id\/photo-reports/, "clients.foto.view"),
  r(READ, /\/clients\/:id\/audit$/, "clients.klient.history"),
  r(READ, /\/clients\/:id\/reconciliation-xlsx$/, "cash.otchety.export"),
  r(READ, /\/clients(\/references)?$/, "clients.klient.view", "clients.karta.view", "clients.vizity.view"),
  r(READ, /\/clients(\/|$)/, "clients.klient.view"),
  r(["POST"], /\/retail-stock\/upload$/, "clients.ostatki_tt.import"),
  r(READ, /\/retail-stock\/template$/, "clients.ostatki_tt.import"),
  r(READ, /\/retail-stock\/export$/, "clients.ostatki_tt.copy"),
  r(READ, /\/retail-stock$/, "clients.ostatki_tt.view"),

  // ─────────── Заявки → Автоматизация заявок ───────────
  // Ro'yxat `?export=csv` (copy) va faqat `is_active` PATCH (activate/deactivate) — handlerda.
  r(READ, /\/order-automation/, "orders.avtomatizatsiya.view", "orders.avtomatizatsiya.create", "orders.avtomatizatsiya.update"),
  r(["POST"], /\/order-(auto-confirm|restriction)-rules(\/:id\/duplicate)?$/, "orders.avtomatizatsiya.create"),
  r(["POST"], /\/order-(auto-confirm|restriction)-rules\/:id\/restore$/, "orders.avtomatizatsiya.restore"),
  r(WRITE, /\/order-(auto-confirm|restriction)-rules/, "orders.avtomatizatsiya.update", "orders.avtomatizatsiya.activate", "orders.avtomatizatsiya.deactivate"),
  r(DEL, /\/order-(auto-confirm|restriction)-rules/, "orders.avtomatizatsiya.delete"),
  r(READ, /\/order-(auto-confirm|restriction)-rules/, "orders.avtomatizatsiya.view", "orders.avtomatizatsiya.export"),

  // ─────────── Настройки: Товар / Цена (products) ───────────
  // Faqat katalog moduli: `/api/:slug/products…`.
  // `/dashboard/supervisor/products` ga tushmasin (aks holda settings.tovar.view talab qilinadi).
  r(WRITE, /\/api\/(?::slug|[^/]+)\/products\/(import|import-catalog)/, "settings.tovar.import"),
  r(READ, /\/api\/(?::slug|[^/]+)\/products\/export-catalog/, "settings.tovar.copy"),
  r(WRITE, /\/api\/(?::slug|[^/]+)\/products\/prices\/import/, "settings.tsena.import", "settings.tsena.create"),
  r(WRITE, /\/api\/(?::slug|[^/]+)\/products\/prices\/matrix$/, "settings.tsena.update"),
  r(WRITE, /\/api\/(?::slug|[^/]+)\/products\/:id\/prices$/, "settings.tsena.update"),
  r(READ, /\/api\/(?::slug|[^/]+)\/products\/:id\/prices$/, "settings.tsena.view"),
  r(READ, /\/product-prices/, "settings.tsena.view"),
  r(WRITE, /\/api\/(?::slug|[^/]+)\/products\/(bulk|bulk-equipment|bulk-kpi-group)$/, "settings.tovar.update"),
  r(WRITE, /\/price-matrix\/(apply|bulk)$/, "settings.tsena.update"),
  r(["POST"], /\/api\/(?::slug|[^/]+)\/products$/, "settings.tovar.create"),
  r(["PUT", "PATCH"], /\/api\/(?::slug|[^/]+)\/products\/:id$/, "settings.tovar.update"),
  r(["DELETE"], /\/api\/(?::slug|[^/]+)\/products\/:id$/, "settings.tovar.delete"),
  r(READ, /\/api\/(?::slug|[^/]+)\/products(\/|$)/, "settings.tovar.view"),
  r(WRITE, /\/settings\/profile$/, "settings.profil_kompanii.update"),
  r(READ, /\/settings\/profile$/, "settings.profil_kompanii.view", "settings.tipy_zadach.view"),
  r(["POST"], /\/settings\/mobile-app-release\/notify$/, "settings.mobile_app.transfer"),
  r(["POST"], /\/settings\/mobile-app-release\/upload$/, "settings.mobile_app.import"),
  r(WRITE, /\/settings\/mobile-app-release/, "settings.mobile_app.update"),
  r(READ, /\/settings\/mobile-app-release/, "settings.mobile_app.view"),
  r(WRITE, /\/settings\/document-edit-lock\/grants/, "settings.document_edit_lock.assign"),
  r(READ, /\/settings\/document-edit-lock\/(search|users)$/, "settings.document_edit_lock.assign"),
  r(READ, /\/settings\/document-edit-lock\/grants$/, "settings.document_edit_lock.view", "settings.document_edit_lock.assign"),
  r(WRITE, /\/settings\/document-edit-lock/, "settings.document_edit_lock.update"),
  r(
    READ,
    /\/settings\/document-edit-lock/,
    "settings.document_edit_lock.view",
    "settings.document_edit_lock.update",
    "settings.document_edit_lock.assign"
  ),
  r(READ, /\/settings\/initial-setup\/export-bundle\.xlsx$/, "settings.initial_setup.export"),
  r(READ, /\/settings\/initial-setup/, "settings.initial_setup.view", "settings.profil_kompanii.view"),
  r(WRITE, /\/system-migration\/import/, "settings.system_migration.update", "settings.system_migration.import", "settings.profil_kompanii.update"),
  r(["POST"], /\/system-migration\/export/, "settings.system_migration.view", "settings.profil_kompanii.view"),
  r(WRITE, /\/settings\/bonus-stack$/, "settings.bonus_strategiya.update"),
  r(READ, /\/system-migration(\/|$)/, "settings.system_migration.view", "settings.profil_kompanii.view"),

  // ─────────── Консигнация ───────────
  r(WRITE, /\/consignment\/settings$/, "staff.konsignatsiya_zakrytie.update"),
  r(["POST"], /\/consignment\/import\.xlsx$/, "staff.konsignatsiya.import"),
  r(READ, /\/consignment\/import-template(\.xlsx)?$/, "staff.konsignatsiya.import"),
  r(WRITE, /\/consignment\/agents\/bulk(-rows)?$/, "staff.konsignatsiya.status", "staff.konsignatsiya.update"),
  r(WRITE, /\/consignment\/limits\/transfer$/, "staff.konsignatsiya_perekid.update"),
  r(WRITE, /\/consignment\/limits\/apply$/, "staff.konsignatsiya_limity.update"),
  r(WRITE, /\/consignment/, "staff.konsignatsiya.update", "staff.konsignatsiya.status", "clients.klient.update"),
  r(READ, /\/consignment/, "staff.konsignatsiya.view", "clients.klient.view"),
  // ─────────── Пользователи (staff) ───────────
  // Excel import (create|update) — before generic POST /agents|staff
  r(["POST"], /\/staff\/import/, "staff.agent.create", "staff.agent.update", "staff.ekspeditor.create", "staff.ekspeditor.update", "staff.supervayzer.create", "staff.supervayzer.update", "staff.inkassator.create", "staff.inkassator.update", "staff.auditor.create", "staff.auditor.update", "staff.skladchik.create", "staff.skladchik.update", "staff.sotrudniki.create", "staff.sotrudniki.update"),
  r(READ, /\/staff\/import/, "staff.agent.view", "staff.ekspeditor.view", "staff.supervayzer.view", "staff.inkassator.view", "staff.auditor.view", "staff.skladchik.view", "staff.sotrudniki.view", "staff.agent.create", "staff.ekspeditor.create", "staff.supervayzer.create", "staff.inkassator.create", "staff.auditor.create", "staff.skladchik.create", "staff.sotrudniki.create"),
  r(["POST"], /\/agents\/import/, "staff.agent.create", "staff.agent.update"),
  r(READ, /\/agents\/import/, "staff.agent.view", "staff.agent.create", "staff.agent.update"),
  r(["POST"], /\/expeditors\/import/, "staff.ekspeditor.create", "staff.ekspeditor.update"),
  r(READ, /\/expeditors\/import/, "staff.ekspeditor.view", "staff.ekspeditor.create", "staff.ekspeditor.update"),
  r(["POST"], /\/supervisors\/import/, "staff.supervayzer.create", "staff.supervayzer.update"),
  r(READ, /\/supervisors\/import/, "staff.supervayzer.view", "staff.supervayzer.create", "staff.supervayzer.update"),
  r(["POST"], /\/collectors\/import/, "staff.inkassator.create", "staff.inkassator.update"),
  r(READ, /\/collectors\/import/, "staff.inkassator.view", "staff.inkassator.create", "staff.inkassator.update"),
  r(["POST"], /\/auditors\/import/, "staff.auditor.create", "staff.auditor.update"),
  r(READ, /\/auditors\/import/, "staff.auditor.view", "staff.auditor.create", "staff.auditor.update"),
  r(["POST"], /\/operators\/import/, "staff.sotrudniki.create", "staff.sotrudniki.update"),
  r(READ, /\/operators\/import/, "staff.sotrudniki.view", "staff.sotrudniki.create", "staff.sotrudniki.update"),
  r(["POST"], /\/skladchik\/import/, "staff.skladchik.create", "staff.skladchik.update"),
  r(READ, /\/skladchik\/import/, "staff.skladchik.view", "staff.skladchik.create", "staff.skladchik.update"),
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
  r(["POST"], /\/expeditors(\/|$)/, "staff.ekspeditor.create"),
  r(["PUT", "PATCH"], /\/expeditors\//, "staff.ekspeditor.update"),
  r(READ, /\/expeditors(\/|$)/, "staff.ekspeditor.view"),
  r(["POST"], /\/supervisors(\/|$)/, "staff.supervayzer.create"),
  r(["PUT", "PATCH"], /\/supervisors\//, "staff.supervayzer.update"),
  r(READ, /\/supervisors(\/|$)/, "staff.supervayzer.view"),
  r(["POST"], /\/collectors(\/|$)/, "staff.inkassator.create"),
  r(["PUT", "PATCH"], /\/collectors\//, "staff.inkassator.update"),
  r(READ, /\/collectors(\/|$)/, "staff.inkassator.view"),
  r(["POST"], /\/auditors(\/|$)/, "staff.auditor.create"),
  r(["PUT", "PATCH"], /\/auditors\//, "staff.auditor.update"),
  r(READ, /\/auditors(\/|$)/, "staff.auditor.view"),
  r(["POST"], /\/operators(\/|$)/, "staff.sotrudniki.create"),
  r(["PUT", "PATCH"], /\/operators\//, "staff.sotrudniki.update"),
  r(READ, /\/operators(\/|$)/, "staff.sotrudniki.view"),
  r(WRITE, /\/staff\/.*\/(activate|deactivate|aktivnost)/, "staff.agent.activate", "staff.agent.deactivate"),
  r(["POST"], /\/staff\//, "staff.agent.create"),
  r(["PUT", "PATCH"], /\/staff\//, "staff.agent.update"),
  r(["DELETE"], /\/staff\//, "staff.agent.delete"),
  r(READ, /\/staff(\/|$)/, "staff.agent.view"),

  // ─────────── Табель / Рабочее место ───────────
  r(WRITE, /\/timesheet\/norm-settings$/, "staff.tabel_normativ.update"),
  r(READ, /\/timesheet\/norm-settings$/, "staff.tabel_normativ.view", "staff.tabel_normativ.update"),
  r(READ, /\/timesheet\/history$/, "staff.tabel.history"),
  r(WRITE, /\/timesheet/, "staff.tabel.update"),
  r(READ, /\/timesheet/, "staff.tabel.view"),
  r(["PUT"], /\/workdays\/enforce-access$/, "staff.rabochie_dni.status"),
  r(["PUT"], /\/workdays\/schedules$/, "staff.rabochie_dni.update"),
  r(["POST"], /\/workdays\/(exceptions|overrides)$/, "staff.rabochie_dni.create"),
  r(DEL, /\/workdays\//, "staff.rabochie_dni.delete"),
  r(WRITE, /\/workdays/, "staff.rabochie_dni.update"),
  r(READ, /\/workdays/, "staff.rabochie_dni.view", "staff.tabel.view"),
  r(READ, /\/tabel-audit/, "audit.tabel.view", "staff.tabel.history", "staff.rabochie_dni.history"),
  r(WRITE, /\/work-slots\/.*\/(assign|unassign)/, "work_slots.raboche_mesto.assign", "work_slots.raboche_mesto.update"),
  r(READ, /\/work-slots\/.*\/sessions/, "work_slots.raboche_mesto.view", "work_slots.raboche_mesto.update"),
  r(WRITE, /\/work-slots\/.*\/sessions/, "work_slots.raboche_mesto.update"),
  r(WRITE, /\/work-slots\/sessions/, "work_slots.raboche_mesto.update"),
  r(WRITE, /\/work-slots/, "work_slots.raboche_mesto.create", "work_slots.raboche_mesto.update", "work_slots.raboche_mesto.assign"),
  r(READ, /\/work-slots\/export\.xlsx$/, "work_slots.raboche_mesto.export"),
  r(READ, /\/work-slots/, "work_slots.raboche_mesto.view"),
  r(WRITE, /\/client-agent-assignments/, "work_slots.raboche_mesto.assign", "work_slots.raboche_mesto.update"),
  r(READ, /\/client-agent-assignments/, "work_slots.raboche_mesto.view"),


  // ─────────── Планы → Настройка утверждающих ───────────
  r(WRITE, /\/plans\/approvers/, "plans.nastroyka_utverzhdayushchih.update"),
  r(READ, /\/plans\/approvers/, "plans.nastroyka_utverzhdayushchih.view"),

  // ─────────── Планы → Установка планов; Отчёт → Дневные KPI планы ───────────
  r(["POST"], /\/plans\/setup\/confirm$/, "plans.ustanovka_planov.update"),
  r(["POST"], /\/plans\/setup\/approve$/, "plans.ustanovka_planov.approve"),
  r(["POST"], /\/plans\/setup\/return$/, "plans.ustanovka_planov.approve"),
  r(WRITE, /\/plans\/setup/, "plans.ustanovka_planov.update", "plans.ustanovka_planov.create"),
  r(READ, /\/plans\/setup/, "plans.ustanovka_planov.view"),
  r(READ, /\/plans\/daily-kpi/, "reports.dnevnye_kpi_plany.view"),

  // ─────────── Dashboard ───────────
  r(READ, /\/dashboard\/sales-monitoring/, "dashboard.prodazhi.view"),
  r(READ, /\/dashboard\/sales/, "dashboard.prodazhi.view"),
  r(READ, /\/dashboard\/finance/, "dashboard.finansy.view", "finance.obzor.view"),
  r(
    READ,
    /\/dashboard\/supervisor\/photo-reports/,
    "dashboard.supervayzer.view",
    "dashboard.supervayzer",
    "clients.foto.view"
  ),
  r(READ, /\/dashboard\/supervisor/, "dashboard.supervayzer.view", "dashboard.supervayzer"),
  r(READ, /\/dashboard(\/|$)/, "dashboard.prodazhi.view"),

  // ─────────── Отчёты ───────────
  r(["POST"], /\/reports\/report-builder\/(preview|dataset)$/, "reports.konstruktor.view"),
  r(["POST"], /\/reports\/report-builder\/export$/, "reports.konstruktor.export"),
  r(READ, /\/reports\/report-builder\/saved\/share-candidates$/, "reports.konstruktor.transfer"),
  r(["POST"], /\/reports\/report-builder\/saved\/:id\/share$/, "reports.konstruktor.transfer"),
  r(["POST"], /\/reports\/report-builder\/saved$/, "reports.konstruktor.create"),
  r(WRITE, /\/reports\/report-builder\/saved\//, "reports.konstruktor.update"),
  r(DEL, /\/reports\/report-builder\/saved\//, "reports.konstruktor.delete"),
  r(READ, /\/reports\/report-builder(\/|$)/, "reports.konstruktor.view"),
  r(READ, /\/reports\/(order-debts|income-report)\/export/, "cash.otchety.export"),
  r(READ, /\/reports\/(order-debts|income-report|cash-flow)(\/|$)/, "cash.otchety.view"),
  ...REPORT_PAGE_PERMISSIONS.flatMap((p) => [
    ...(p.export ? [r(READ, new RegExp(`/reports/${p.path}/export`), `${p.section}.export`)] : []),
    r(READ, new RegExp(`/reports/${p.path}(/|$)`), `${p.section}.view`)
  ]),
  // Sahifasi yo'q analitik API (`/reports/sales`, `receivables` ...) — istalgan hisobot guruhi.
  r(READ, /\/reports\/.*\/export/, ...REPORT_GROUP_EXPORT_PERMISSIONS),
  r(WRITE, /\/reports\/builder/, "reports.konstruktor.create", "reports.konstruktor.update"),
  r(READ, /\/reports\/builder/, "reports.konstruktor.view"),
  r(READ, /\/reports(\/|$)/, ...REPORT_GROUP_VIEW_PERMISSIONS),

  // ─────────── Бонусы и скидки (bonus-rules) ───────────
  // Bonus (`qty`) yoki skidka (`sum`/`discount`) — aniq bo'lim handlerda qoida turi bo'yicha tekshiriladi.
  r(WRITE, /\/bonus-rules\/bulk$/, "settings.bonusy.update", "settings.skidki.update"),
  r(WRITE, /\/bonus-rules\/:id\/active$/, "settings.bonusy.update", "settings.skidki.update"),
  r(WRITE, /\/bonus-rules\/:id\/order-scope$/, "settings.bonusy.update", "settings.skidki.update"),
  r(["POST"], /\/bonus-rules$/, "settings.bonusy.create", "settings.skidki.create"),
  r(["PUT", "PATCH"], /\/bonus-rules\/:id$/, "settings.bonusy.update", "settings.skidki.update"),
  r(["DELETE"], /\/bonus-rules\/:id$/, "settings.bonusy.delete", "settings.skidki.delete"),
  r(READ, /\/bonus-rules(\/|$)/, "settings.bonusy.view", "settings.skidki.view"),

  // ─────────── Стратегия бонусов и скидок ───────────
  r(["POST"], /\/bonus-strategies$/, "settings.bonus_strategiya.create"),
  r(["PUT", "PATCH"], /\/bonus-strategies\/:id(\/active)?$/, "settings.bonus_strategiya.update"),
  r(["DELETE"], /\/bonus-strategies\/:id$/, "settings.bonus_strategiya.delete"),
  r(READ, /\/bonus-strategies(\/|$)/, "settings.bonus_strategiya.view"),

  // ─────────── Отказы (refusals) ───────────
  r(WRITE, /\/refusals(\/|$)/, "orders.otkazy.create"),
  r(READ, /\/refusals(\/|$)/, "orders.otkazy.view"),

  // ─────────── Аудит ───────────
  r(READ, /\/audit-events\/export\.xlsx$/, "audit.log.export"),
  r(READ, /\/audit-events(\/|$)/, "audit.log.view"),

  // ─────────── Диагностика (xatolik loglari) ───────────
  r(READ, /\/error-events(\/|$)/, "diagnostics.error_logs.view"),

  // ─────────── Доступ (access workspace) ───────────
  r(WRITE, /\/access\/(users|role-defaults|users-bulk)/, "access.upravlenie.update"),
  r(READ, /\/access\/(users|role-defaults|history|permissions|dimensions|territories|operations-tree)(\/|$)/, "access.upravlenie.view"),

  // ─────────── Справочники / территория / направления ───────────
  // `/territories` GET — ko'p sahifalar (filtrlar) ishlatadi, shuning uchun faqat yozish cheklanadi.
  r(["POST"], /\/territories$/, "settings.territoriya.create"),
  r(WRITE, /\/territories\/:id(\/(assign|unassign|restore))?$/, "settings.territoriya.update"),
  r(DEL, /\/territories\/:id$/, "settings.territoriya.delete"),
  r(WRITE, /\/territory(\/|$)/, "settings.territoriya.create", "settings.territoriya.update", "settings.territoriya.delete"),
  r(READ, /\/territory(\/|$)/, "settings.territoriya.view"),
  r(["POST"], /\/trade-directions$/, "settings.napravlenie_torgovli.create"),
  r(WRITE, /\/trade-directions\//, "settings.napravlenie_torgovli.update"),
  r(DEL, /\/trade-directions\//, "settings.napravlenie_torgovli.delete"),
  r(WRITE, /\/sales-directions(\/|$)/, "settings.napravlenie_torgovli.create", "settings.napravlenie_torgovli.update", "settings.napravlenie_torgovli.delete"),
  r(READ, /\/sales-directions(\/|$)/, "settings.napravlenie_torgovli.view"),
  r(WRITE, /\/(sales-channels|kpi-groups|product-categories)(\/|$)/, "settings.tovar.update"),
  r(DEL, /\/(sales-channels|kpi-groups|product-categories)(\/|$)/, "settings.tovar.update"),
  r(WRITE, /\/reference(\/|$)/, "settings.tovar.update"),
  r(READ, /\/reference(\/|$)/, "settings.tovar.view"),

  // ─────────── Связи (linkage) ───────────
  r(WRITE, /\/linkage(\/|$)/, "clients.gr_komanda.update", "clients.klient.update"),
  r(READ, /\/linkage(\/|$)/, "clients.klient.view"),

  // ─────────── Полевые / GPS / маршруты ───────────
  // Xodim turi (agent, dostavshik, ...) va trek — handlerda (`resolveGpsAccess`) filtrlanadi.
  r(READ, /\/gps-monitoring(\/|$)/, ...GPS_MONITORING_VIEW_PERMISSIONS),
  // `PUT /agent-route-days` — agent/ekspeditor o'z marshrutini saqlaydi; boshqasiga `gps.marshrut.update` handlerda.
  r(READ, /\/agent-route-days\/(suggest|agents)$/, "gps.marshrut.view", "gps.marshrut.update"),

  r(READ, /\/api\/[^/]+\/tasks\/export/, "staff.zadachi_spisok.export"),
  r(["POST"], /\/api\/[^/]+\/tasks$/, "staff.zadachi_spisok.create"),
  r(["POST"], /\/api\/[^/]+\/tasks\/:id\/cancel$/, "staff.zadachi_spisok.delete"),
  r(WRITE, /\/api\/[^/]+\/tasks\//, "staff.zadachi_spisok.update"),
  r(READ, /\/api\/[^/]+\/tasks\/meta$/, "staff.zadachi_spisok.view", "staff.zadachi_spisok.create", "staff.zadachi_spisok.update"),
  r(READ, /\/api\/[^/]+\/tasks(\/|$)/, "staff.zadachi_spisok.view"),
  r(["POST"], /\/geo-boundaries\/:id\/restore$/, "settings.geo_granitsy.update"),
  r(["POST"], /\/geo-boundaries\/:id\/assign-clients$/, "settings.geo_granitsy.assign"),
  r(DEL, /\/geo-boundaries(\/|$)/, "settings.geo_granitsy.void"),
  r(WRITE, /\/geo-boundaries(\/|$)/, "settings.geo_granitsy.create", "settings.geo_granitsy.update"),
  r(READ, /\/geo-boundaries(\/|$)/, "settings.geo_granitsy.view"),

  // ─────────── Уведомления ───────────
  r(WRITE, /\/notifications(\/|$)/, "staff.zadachi.update"),
  r(READ, /\/notifications(\/|$)/, "staff.zadachi.view"),

  // ─────────── Активность ───────────
  r(READ, /\/activity(\/|$)/, "activity.history.view")
];

function matchRule(method: string, routePath: string): RoutePermissionRule | null {
  const candidates = pathsToMatch(routePath);
  // Mobil API o‘z JWT+rol guardida; veb CRUD kalitlari (`clients.foto.view` va h.k.)
  // `/mobile/clients/:id/photo-reports` ga tushmasin.
  if (candidates.some((c) => c.includes("/mobile/") || c.includes("/telegram-bot/"))) return null;
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (!rule.methods.includes(method as Method)) continue;
    if (candidates.some((c) => rule.test.test(c))) return rule;
  }
  return null;
}

/**
 * Fastify 4 pattern (`/orders/:id`), regex cheklovli pattern (`/orders/:id(\\d+)`), boshqa nomli parametr
 * (`/warehouses/:warehouseId`) va aniq URL (`/orders/5`) — hammasi bir xil `:id` qoidalari bilan solishtiriladi.
 */
function pathsToMatch(routePath: string): string[] {
  const path = (routePath.split("?")[0] ?? "").trim();
  if (!path) return [];
  const stripped = path.replace(/(:[A-Za-z_][A-Za-z0-9_]*)\([^)]*\)/g, "$1");
  const asParam = stripped
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/:(?!slug(?=\/|$))[A-Za-z_][A-Za-z0-9_]*(?=\/|$)/g, "/:id");
  const asShift = asParam.replace(/\/:id\/shifts\/:id(?=\/|$)/, "/:id/shifts/:shiftId");
  return [...new Set([path, stripped, asParam, asShift])];
}

/** Test/diagnostika uchun eksport. */
export { ROUTE_PERMISSION_RULES, matchRule };

export function registerRoutePermissionGuard(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (env.RBAC_ENFORCE_PERMISSIONS !== "1") return;

    const method = request.method.toUpperCase();
    // Haqiqiy URL — `routeOptions.url` ba'zan faqat `/clients` bo'lishi mumkin
    // (prefix/encapsulate); mobil API veb CRUD kalitlariga tushmasin.
    const rawUrl = (request.url ?? "").split("?")[0] ?? "";
    if (rawUrl.includes("/mobile/") || rawUrl.includes("/telegram-bot/")) return;

    const routePath =
      (request as { routeOptions?: { url?: string } }).routeOptions?.url ??
      (request as { routerPath?: string }).routerPath ??
      "";
    // Noma'lum marshrut — route o'z 401/404 beradi; bu yerda 403 bermaymiz.
    if (!routePath) return;

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
