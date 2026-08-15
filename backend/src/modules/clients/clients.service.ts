/**
 * Domain: Clients (CRUD, import, dedupe, balans bog‘lanishi).
 * Boundary: route → multipart/import alohida; servis → tenantId param, audit, ledger merge.
 * Bog‘liq: `clients.route.ts`, `contracts/clients.schemas.ts`, `docs/domain-boundary.md`.
 */
export * from "./clients.types";
export * from "./clients.helpers";
export * from "./clients.agent-assignments";
export * from "./clients.audit";
export * from "./clients.references";
export * from "./clients.list";
export * from "./clients.detail";
export * from "./clients.write";
export * from "./clients.merge";
export * from "./clients.import";
export * from "./clients.tags";
