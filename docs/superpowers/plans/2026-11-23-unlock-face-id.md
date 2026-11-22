# Unlock Face ID Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** SmoothUI UnlockFaceId glyph on web Face login preview and Flutter daily/verify Face gate.

**Architecture:** Controlled status only (real camera/verify). Web uses `motion`; Flutter CustomPainter + AnimationController. No fake timeout success.

**Tech Stack:** React 18, Next, Tailwind, `motion`, Flutter.

**Spec:** `docs/superpowers/specs/2026-11-23-unlock-face-id-design.md`

## Global Constraints

- Controlled mode for auth; no uncontrolled scanDuration success.
- MIT attribution in file header.
- New files ≤400 LOC.
- No commit unless user asks.

## Review Focus

- Failure maps to error status, not idle.
- Reduced motion skips path draw / shake.
- Flutter verify still calls server before success.
- Web overlay does not block camera (pointer-events-none).
- Brand stroke uses currentColor / primary, not forced purple.

## File map

- Create: `frontend/components/ui/unlock-face-id.tsx`
- Modify: `frontend/package.json` (motion)
- Modify: `frontend/components/login/face-liveness-preview.tsx`
- Create: `mobile/lib/core/face/unlock_face_id.dart`
- Create: `mobile/lib/core/face/unlock_face_id_sheet.dart`
- Modify: `mobile/lib/core/face/face_verification_flow.dart`

### Task 1: Web component + motion

- [x] Install `motion` in frontend
- [x] Add SmoothUI `UnlockFaceId` with MIT header, RU status strings option via props already
- [x] Wire preview: map outcome/phase → status; replace FaceScanIndicator center overlay
- [x] eslint on touched files

### Task 2: Flutter glyph + sheet

- [x] `UnlockFaceId` widget (idle/scanning/success/error)
- [x] Sheet wraps scan → picker → verify; status transitions
- [x] Replace `_captureAndVerify` dialog with sheet
- [x] `dart analyze` on new files if available

### Task 3: Verify

- [x] `npm run lint:errors --prefix frontend` (or eslint paths)
- [x] `npm run audit:max-loc`
