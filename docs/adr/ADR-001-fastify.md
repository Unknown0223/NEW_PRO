# ADR-001: Fastify backend framework

**Status:** Accepted  
**Date:** 2026-07-05

## Context

SALEC backend REST API, real-time order events, fayl import va background joblarni qo‘llab-quvvatlashi kerak.

## Decision

**Fastify 4** asosiy HTTP framework sifatida tanlandi.

## Rationale

- Yuqori throughput va past overhead (Express ga nisbatan)
- Plugin arxitekturasi (`@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`)
- Schema-based validation integratsiyasi (Zod alohida qatlam)
- TypeScript bilan yaxshi moslik

## Consequences

- Route registratsiya markazlashtirilgan: `route-registry.ts`
- Error handler va observability pluginlar orqali kengaytiriladi
- OpenAPI generatsiya alohida skript (`npm run openapi:generate`)

## Alternatives considered

- **NestJS** — ortiqcha boilerplate monolith uchun
- **Hono** — ekosistema va BullMQ integratsiyasi kamroq olg‘an
