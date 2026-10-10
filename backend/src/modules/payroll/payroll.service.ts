/**
 * ЗАРПЛАТА (payroll) — domain barrel.
 *
 * Qatlam:
 *  - sof mantiq (engine/grid/gates/components/strategies/money) — DB siz test qilinadi
 *  - CRUD / metrics / period / payments — Prisma
 *  - `payroll.route.ts` — Fastify marshrutlari
 */
export * from "./payroll.types";
export * from "./payroll.money";
export * from "./payroll.roles";
export * from "./payroll.grid";
export * from "./payroll.gates";
export * from "./payroll.components";
export * from "./payroll.strategies";
export * from "./payroll.engine";
export * from "./payroll.planned-days";
export * from "./payroll.mappers";
export * from "./payroll.schema";
export * from "./payroll.formulas.crud";
export * from "./payroll.grids.crud";
export * from "./payroll.metrics";
export * from "./payroll.period";
export * from "./payroll.entry-row";
export * from "./payroll.entries";
export * from "./payroll.payments";
