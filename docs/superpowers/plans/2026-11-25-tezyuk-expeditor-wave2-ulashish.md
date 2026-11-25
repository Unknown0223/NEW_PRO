# TezYuk Wave 2 — Ulashish + web partnyorlar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship order-share (Ulashish) end-to-end: state machine + locks, mobile TezYuk screens, web per-expeditor partners — without changing primary `expeditor_user_id`.

**Architecture:** Pure transition module (Vitest) owns statuses/errors; Fastify routes under `/mobile/expeditor/share/*` and web `/settings/expeditor-partners`; Flutter feature `features/expeditor/share/` gated by `isTezyukProduct`. Handoff requires GPS proximity (~150 m) + photo before `faol`.

**Tech Stack:** Prisma/Postgres, Fastify, Vitest; Flutter Riverpod + go_router; Next.js settings page + existing permission patterns.

**Spec:** `docs/superpowers/specs/2026-11-25-tezyuk-expeditor-app-design.md` (Wave 2 section)

**Status 2026-11-25:** WIP — share pure/routes/partners/mobile kod + migration branchda; Hetzner deployda park qilingan edi (`tmp-wip-tezyuk-share/` lokal). E’tiroz: broken share WIP tsc buzadi → park. Holat: `2026-11-25-otchot-tezyuk-status-va-etirozlar.md`.

## Global Constraints

- LOC ≤400 per new file (`audit:max-loc`); split early.
- Picker labels: name only (`.cursor/rules/picker-labels.mdc`).
- Primary `expeditor_user_id` never reassigned on share; mark `Ulashilgan`.
- No `faol` without GPS+photo handoff.
- Partner list empty → own-warehouse expeditors; non-empty → only partners.
- Commit steps: skip unless user asks.
- TezYuk APK builds: `C:\salesdoc_mobile` sync path (`--flavor tezyuk`).

## Review Focus

1. Sender JWT after accept still calls deliver/pay → expect `SHARE_SENDER_CANNOT_ACT` / HTTP 403.
2. Partial accept leaves unselected orders unlocked for sender → selected stay locked to receiver.
3. GPS distance just over configured radius → `SHARE_NOT_SAME_LOCATION`, stay `yuk_kutilmoqda`.
4. Partner list non-empty but recipient from own warehouse not in partners → `SHARE_NOT_SAME_WAREHOUSE` / not listed.
5. Timeout at end of workday on `kutilmoqda` → `bekor` / expired code; accepted shares not auto-cancelled.

---

### Task 1: Share state machine (pure)

**Files:**
- Create: `backend/src/modules/mobile/share/share-state.pure.ts`
- Create: `backend/src/modules/mobile/share/share-codes.ts`
- Test: `backend/tests/share-state.pure.test.ts`

**Interfaces:**
- Produces:
  - `type ShareStatus = 'kutilmoqda' | 'korildi' | 'qisman_qabul' | 'qabul_qilindi' | 'yuk_kutilmoqda' | 'faol' | 'rad' | 'bekor' | 'qaytarish_kutilmoqda' | 'qaytarildi' | 'tugallandi'`
  - `type ShareEvent = 'VIEW' | 'ACCEPT_FULL' | 'ACCEPT_PARTIAL' | 'REJECT' | 'CANCEL' | 'HANDOFF_OK' | 'RETURN_REQUEST' | 'RETURN_ACCEPT' | 'EXPIRE'`
  - `transitionShare(from: ShareStatus, event: ShareEvent, role: 'sender' | 'receiver'): ShareStatus` — throws coded error
  - Error string constants: `SHARE_*` matching spec (`ShareSenderCannotAct` → `SHARE_SENDER_CANNOT_ACT`, etc.)

- [ ] **Step 1: Write failing tests** — VIEW only from `kutilmoqda`→`korildi` by receiver; CANCEL only sender on `kutilmoqda|korildi`; HANDOFF_OK only from `yuk_kutilmoqda`→`faol`; sender ACCEPT throws

- [ ] **Step 2: Run** `npm run test:ci --prefix backend -- tests/share-state.pure.test.ts`  
  Expected: FAIL (module missing)

- [ ] **Step 3: Implement** `transitionShare` + codes

- [ ] **Step 4: Run** — Expected: PASS

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 2: Schema + partner model

**Files:**
- Create: Prisma migration under `backend/prisma/migrations/` — tables `expeditor_share_partner`, `expeditor_share_request`, `expeditor_share_order`, `expeditor_share_handoff`
- Modify: `backend/prisma/schema.prisma`
- Test: `backend/tests/share-partner-eligibility.pure.test.ts` (pure eligibility helper, no DB)

**Interfaces:**
- Produces:
  - `eligibleRecipients(ownWarehouseIds, partners: {userId}[], candidates): {userId}[]` — empty partners → filter by warehouse; else intersect partners
  - Columns (min): request `status`, `sender_user_id`, `receiver_user_id`, `expires_at`; order `order_id`, `accepted`; handoff `lat/lng/photo_key` per party; partner `owner_expeditor_user_id`, `partner_expeditor_user_id`

- [ ] **Step 1–4:** TDD eligibility; migrate schema; document SQL in migration

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 3: Share API — create / list / detail / cancel / view

**Files:**
- Create: `backend/src/modules/mobile/share/share.service.ts` (+ split if >400)
- Create: `backend/src/modules/mobile/mobile.route.expeditor.share.ts`
- Modify: mobile route registrar to mount share routes
- Test: `backend/tests/share-create.lock.test.ts` (pure lock matrix + service helpers with fixtures)

**Interfaces:**
- Consumes: `transitionShare`, eligibility
- Produces routes (JWT expeditor):
  - `POST /api/:slug/mobile/expeditor/share` `{ order_ids, receiver_user_id }` → request id; locks orders
  - `GET /api/:slug/mobile/expeditor/share` `?box=inbox|outbox`
  - `GET /api/:slug/mobile/expeditor/share/:id`
  - `POST /api/:slug/mobile/expeditor/share/:id/cancel` (sender)
  - Open detail as receiver → auto VIEW transition
- Lock helper: `assertOrderShareActionAllowed({ orderId, actorUserId })` → throws `SHARE_ORDER_ALREADY_LOCKED` / `SHARE_SENDER_CANNOT_ACT`

- [ ] **Step 1–4:** TDD lock helper + create rejects second share on locked order

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 4: Accept partial / reject + handoff GPS/photo

**Files:**
- Modify: `share.service.ts` / new `share-accept.service.ts`, `share-handoff.service.ts`
- Modify: `mobile.route.expeditor.share.ts`
- Test: `backend/tests/share-accept-handoff.pure.test.ts`

**Interfaces:**
- Produces:
  - `POST .../share/:id/accept` `{ order_ids: number[] }` — empty → reject path; subset → `qisman_qabul` then `yuk_kutilmoqda` after both sides; unselected unlock to sender
  - `POST .../share/:id/reject`
  - `POST .../share/:id/handoff` `{ lat, lng, photo_key }` — both parties; `haversineMeters` ≤ config (default **150**); missing photo → `SHARE_PHOTO_REQUIRED`; far → `SHARE_NOT_SAME_LOCATION`
  - `haversineMeters(a, b): number`

- [ ] **Step 1–4:** TDD haversine threshold + photo required; wire routes

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 5: Gate existing expeditor mutations on share lock

**Files:**
- Modify: `mobile.expeditor.workflow.deliver.ts` / status / payments entry points (minimal hook)
- Test: extend `share-create.lock.test.ts` or `share-sender-cannot-act.test.ts`

**Interfaces:**
- Consumes: `assertOrderShareActionAllowed`
- Produces: deliver/pay/return for locked order as non-receiver → `SHARE_SENDER_CANNOT_ACT`

- [ ] **Step 1–4:** TDD one mutation path; apply same guard to sibling mutations listed in service

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 6: Web expeditor partners CRUD

**Files:**
- Create: backend web routes `backend/src/modules/.../expeditor-partners.route.ts` (follow settings permission style)
- Create: `frontend/app/(dashboard)/settings/expeditor-partners/page.tsx` (+ small components under `frontend/components/settings/expeditor-partners/`)
- Test: `frontend/tests/expeditor-partners.contract.test.ts`; backend eligibility already Task 2

**Interfaces:**
- Produces: list/add/remove partners for a selected expeditor; roles admin / manager / logistics / warehouse_manager per spec; expeditor cannot mutate
- Picker: display **name only**

- [ ] **Step 1–4:** Contract test for empty→own warehouse messaging; implement page + API

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 7: Mobile share API client + models

**Files:**
- Create: `mobile/lib/core/api/expeditor_share_api.dart`
- Create: `mobile/lib/features/expeditor/share/share_models.dart`
- Test: `mobile/test/unit/share_models_test.dart`

**Interfaces:**
- Produces: `ShareRequestSummary`, `parseShareStatus`, API methods mirroring Task 3–4 routes

- [ ] **Step 1–4:** TDD parse/status labels; implement client

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 8: Mobile Ulashish UI (7 surfaces, TezYuk-only)

**Files:**
- Create: `mobile/lib/features/expeditor/share/` pages: inbox/outbox list, create, detail, accept-partial, handoff, return-flow (split ≤400 LOC)
- Modify: `app_router.dart`, `role_guard.dart`, `expeditor_profile_shortcuts.dart` — enable Ulashish (`enabled: true`, clear badge)
- Modify: `expeditor_drawer.dart` — onTap → `/exp-share`
- Test: `mobile/test/unit/expeditor_profile_shortcuts_test.dart` update; `share_lock_matrix_test.dart` for UI-facing lock copy helper

**Interfaces:**
- Consumes: share API client
- Produces: routes `/exp-share`, `/exp-share/create`, `/exp-share/:id`, `/exp-share/:id/handoff`
- Stitch refs: `ulashish_*` from Desktop katalog (layout best-effort; UX parity over pixel paste)

- [ ] **Step 1:** Update shortcut test — Wave 2 enabled, no «Tez orada»

- [ ] **Step 2:** FAIL then implement shortcut + routes + list/detail minimal

- [ ] **Step 3:** Create + partial accept + handoff screens

- [ ] **Step 4:** `flutter test` share + profile tests — PASS

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 9: Notifications codes + quality gate

**Files:**
- Modify: existing mobile notification mapper / push hook to recognize `SHARE_*` event codes (map only; provider wiring YAGNI if infra already generic)
- Test: backend suite share-* + `npx tsc -p tsconfig.json --noEmit`; frontend `lint:errors` + partners contract; mobile share unit tests; `npm run audit:max-loc`

- [ ] **Step 1: Run** full Wave 2 test set (commands above)  
  Expected: all PASS

- [ ] **Step 2: Sync-build** `flutter build apk --debug --flavor tezyuk` from `C:\salesdoc_mobile`  
  Expected: Built `app-tezyuk-debug.apk`

- [ ] **Step 3: Smoke note** — create share → accept → handoff fields rejected without photo (API or UI)

- [ ] **Step 4: Commit** — skip unless asked

---

## Out of this plan

- Wave 3 Agent↔SVR cover
- Faza B `mobile_expeditor/` extract
- Full Stitch pixel polish for Wave 1 screens still deferred

## Spec coverage (self-check)

| Spec item | Task |
|-----------|------|
| Status machine + codes | T1 |
| Partners empty vs non-empty | T2, T6 |
| Create/list/view/cancel | T3 |
| Partial accept / reject / handoff GPS+photo | T4 |
| Sender cannot act when active | T5 |
| Web partner CRUD + roles | T6 |
| Mobile 7 Ulashish surfaces + enable shortcut | T7–T8 |
| SHARE_* notifications | T9 |
| Tests + quality | T1–T9 |
| Cover / payroll | Out → Wave 3 |
