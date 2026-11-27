# outlet-class SalesDoc columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** `#15` `/reports/outlet-class` ni SalesDoc «Классификация торговых точек» jadvali bilan to‘liq: Identifikatsiya, Territorия, Кол-во клиентов, Доля категорий (%), export mos.

**Architecture:** BE `outlet-class-report` row + `category_columns` / `category_shares`; FE FlatReport dinamik ustunlar + mavjud `formatOutletClassRowLabel`.

**Tech Stack:** Prisma SQL, FlatReportPage, Vitest.

## File map

- Modify: `backend/src/modules/reports/outlet-class-report.types.ts`
- Modify: `backend/src/modules/reports/outlet-class-report.report.ts` (yoki split `outlet-class-report.category-shares.ts` agar ≥400)
- Modify: `backend/src/modules/reports/outlet-class-report.export.ts`
- Modify: `frontend/app/(dashboard)/reports/outlet-class/page.tsx`
- Modify: `frontend/tests/outlet-class-flatreport.contract.test.ts`
- Modify: `backend/tests/outlet-class-report.pure.test.ts` (agar pure helper)
- Modify: parity docs `#15`

## Task 1: BE asosiy ustunlar

- [x] types: `client_code`, `territory`, `client_count`; response `category_columns`
- [x] report SQL: client code, territory concat, class agg `COUNT(*)` client_count
- [x] test / tsc

## Task 2: BE Доля категорий

- [x] order_items → product_categories sum per client; % of sales_sum
- [x] class mode: aggregate shares across clients in class
- [x] return `category_shares` map + ordered `category_columns`

## Task 3: FE + export

- [x] columns: Klassifikatsiya, Identifikatsiya, Territorия, counts, sum, avg, dinamik % cols
- [x] export headers/rows sync
- [x] contract test

## Task 4: Parity docs

- [x] mark `#15` SalesDoc columns Done; next = `#16+` deep review yoki `#13` matrix
