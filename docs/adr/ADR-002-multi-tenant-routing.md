# ADR-002: Multi-tenant slug routing

**Status:** Accepted  
**Date:** 2026-07-05

## Context

Bitta deploy bir nechta tenant (mijoz kompaniya) xizmat qiladi.

## Decision

URL pattern: `/api/:slug/*` — `tenant.plugin.ts` slug dan tenant kontekstini yuklaydi.

## Rationale

- Frontend va mobile bir xil API shakli
- JWT ichida `tenantId` — cross-tenant so‘rovlar 403
- Subdomain routing talab qilmaydi (Railway sodda deploy)

## Consequences

- Har bir route `ensureTenantContext` yoki plugin orqali tenant tekshiradi
- Seed: `test1`, `demo` tenant sluglari
- Audit: `npm run audit:route-tenant`

## Alternatives considered

- **Subdomain** (`tenant.app.com`) — DNS va SSL murakkabligi
- **Header-only tenant** — brauzer CORS va debug qiyin
