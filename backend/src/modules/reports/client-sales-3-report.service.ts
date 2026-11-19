/** Продажи по клиентам 3 — SalesDoc `/report/customer/clientList` mosligi. */
export type { ClientSales2Filters as ClientSales3Filters, ReportActor } from "./client-sales-2.types";
export { parseClientSales2Query as parseClientSales3Query } from "./client-sales-2.parse";
export { getClientSales2FilterOptions as getClientSales3FilterOptions } from "./client-sales-2.filters";
export { getClientSales3Report } from "./client-sales-3.report";
export { exportClientSales3Xlsx } from "./client-sales-3.export";
