# ADR-003: Prisma multi-file schema

**Status:** Accepted  
**Date:** 2026-07-05

## Context

100+ model — bitta `schema.prisma` fayl qiyin boshqariladi.

## Decision

`backend/prisma/schema.prisma` — generator/datasource; modellar `prisma/models/group-*.prisma` da.

## Rationale

- Domain bo‘yicha guruhlash (orders, clients, stock, …)
- Migratsiyalar `prisma/migrations/` da saqlanadi
- `prisma migrate deploy` CI/CD da standart

## Consequences

- Yangi model: mos `group-*.prisma` + migration
- `$transaction` o‘rniga `withTransaction()` afzal (project-standards)
- Raw SQL: faqat `Prisma.sql` tagged template

## Alternatives considered

- **Drizzle ORM** — mavjud Prisma investitsiyasi katta
- **Bitta schema fayl** — merge conflict va navigatsiya muammosi
