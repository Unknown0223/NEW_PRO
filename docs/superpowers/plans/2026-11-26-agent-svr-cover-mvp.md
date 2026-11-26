# Agent ↔ SVR Cover MVP (Wave 3-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MVP cover so an agent's assigned SVR can run their route for a day with Face ID accept, one active cover/day, and payroll `SVR_COVER` exclude for the agent.

**Architecture:** Pure transition + eligibility modules (Vitest) → Prisma `agent_svr_covers` → Fastify mobile routes under `/api/:slug/mobile/cover/*` → SalesDoc Flutter agent/SVR screens. Does not touch TezYuk expeditor share.

**Tech Stack:** Prisma/PostgreSQL, Fastify, Vitest, Flutter Riverpod (SalesDoc flavor).

**Spec:** `docs/superpowers/specs/2026-11-26-agent-svr-cover-mvp-design.md`

## Global Constraints

- SalesDoc agent/supervisor only; TezYuk expeditor unchanged.
- Existing SalesDoc production APK binary not replaced; new APIs additive.
- Commit only if user asks.
- Tabel default: warn if agent punches while covered.

## Review Focus

- Non-linked SVR/agent pair rejected
- Second cover same day rejected
- Payroll excludes agent on cover days
- Face required before accept becomes active
- Agent mutations blocked while cover active (or routed to executor)

---

### Task 1: Pure cover state + eligibility

**Files:**
- Create: `backend/src/modules/mobile/cover/cover-codes.ts`
- Create: `backend/src/modules/mobile/cover/cover-state.pure.ts`
- Create: `backend/src/modules/mobile/cover/cover-eligibility.pure.ts`
- Test: `backend/tests/cover-state.pure.test.ts`
- Test: `backend/tests/cover-eligibility.pure.test.ts`

**Interfaces:**
- Produces: `CoverStatus = 'kutilmoqda' | 'faol' | 'tugallandi' | 'rad' | 'bekor'`
- Produces: `transitionCover(status, event, actor: 'agent'|'svr')`
- Produces: `assertLinkedPair(agentSupervisorId, svrUserId)`
- Produces: `assertOneActivePerDay(existingActiveSameDay: boolean)`

- [ ] **Step 1: Write failing tests** for ACCEPT only from kutilmoqda; END from faol; reject wrong SVR
- [ ] **Step 2: Run** `npm run test:ci --prefix backend -- tests/cover-state.pure.test.ts tests/cover-eligibility.pure.test.ts` — FAIL
- [ ] **Step 3: Implement pure modules**
- [ ] **Step 4: Run** — PASS
- [ ] **Step 5: Commit** — skip unless asked

### Task 2: Schema + migration

**Files:**
- Create: `backend/prisma/models/group-agent-cover.prisma`
- Create: `backend/prisma/migrations/20261126120000_agent_svr_cover/migration.sql`
- Modify: ensure prisma schema includes model

**Columns (min):** `id`, `tenant_id`, `agent_user_id`, `svr_user_id`, `status`, `cover_date` (date), `requested_by_user_id`, `accepted_at`, `ended_at`, `agent_face_ok`, `svr_face_ok`, `created_at`, `updated_at`  
Unique partial: one `faol` per `(tenant_id, agent_user_id, cover_date)`.

- [ ] **Step 1–4:** SQL + model; `prisma generate` if possible
- [ ] **Step 5: Commit** — skip

### Task 3: Cover service + mobile routes

**Files:**
- Create: `backend/src/modules/mobile/cover/cover.service.ts`
- Create: `backend/src/modules/mobile/mobile.route.cover.ts`
- Modify: mobile route registrar to include cover
- Test: `backend/tests/cover-service.contract.test.ts` (file/API shape) + extend pure if needed

**Endpoints:**
- `POST /api/:slug/mobile/cover` — create `{ agent_user_id, svr_user_id, cover_date? }`
- `POST /api/:slug/mobile/cover/:id/accept` — `{ face_ok: true }`
- `POST /api/:slug/mobile/cover/:id/face` — mark actor face
- `GET /api/:slug/mobile/cover` — list mine
- `GET /api/:slug/mobile/cover/active` — current faol for me
- `POST /api/:slug/mobile/cover/:id/end`

- [ ] **Step 1–4:** TDD contract + implement
- [ ] **Step 5: Commit** — skip

### Task 4: Payroll exclude hook

**Files:**
- Create: `backend/src/modules/payroll/payroll-cover.pure.ts`
- Modify: payroll input/load path that enumerates agent days (smallest hook)
- Test: `backend/tests/payroll-cover.pure.test.ts`

**Interfaces:**
- Produces: `shouldExcludeAgentDay(coverActive: boolean): boolean`
- Produces: `svrCoverTag(): 'SVR_COVER'`

- [ ] **Step 1–4:** failing test → implement → pass
- [ ] **Step 5: Commit** — skip

### Task 5: Mobile SalesDoc cover UI (minimal)

**Files:**
- Create: `mobile/lib/core/api/cover_api.dart`
- Create: `mobile/lib/features/cover/cover_request_page.dart`
- Create: `mobile/lib/features/cover/cover_active_banner.dart`
- Modify: `app_router.dart` — `/cover`, `/cover/:id`
- Modify: agent home + supervisor home/menu — entry + banner if active
- Test: `mobile/test/unit/cover_models_test.dart`

- [ ] **Step 1–4:** models test + wire screens (Face: reuse existing face verify if available, else `face_ok` flag from local confirm for MVP)
- [ ] **Step 5: Commit** — skip

### Task 6: Gate + docs

**Files:**
- Modify: `docs/superpowers/plans/2026-11-26-tezyuk-closeout-otchot.md` — Wave 3 MVP note
- Run: backend tsc, cover tests, audit:max-loc, flutter test cover

- [ ] **Step 1: Run** verification commands
- [ ] **Step 2: Update closeout
- [ ] **Step 3: Commit** — skip
