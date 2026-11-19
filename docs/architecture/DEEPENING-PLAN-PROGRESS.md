# Architecture deepen — reja va holat

**Sana:** 2026-11-19  
**Branch:** `feature/mobile-ui-redesign`  
**Maqsad:** shallow/god-modulllarni deep module + thin adapter/composer ga aylantirish (GLOSSARY + ADR).

## Reja (#1 → #4)

| # | Modul | Grill | M1 | Holat |
|---|--------|-------|----|--------|
| 1 | **ClientBalanceMutator** (yozuv) | ✅ | ✅ yopildi | ADR-005 |
| 2 | **ClientBalanceDisplay** (o‘qish) | ✅ | ✅ yopildi | ADR-006 |
| 3 | **StockReservation** | ✅ | ✅ yopildi (M1.1–1.4) | ADR-007 |
| 4 | **OrderCreate** (FE god-hook) | ✅ | ✅ yopildi (M1.1–1.4) | ADR-008 |

**Hozir:** #1–#4 ning M1 checklist’lari yopilgan. Keyingi deepen nomzodlari GLOSSARY «Related (not yet deepened)» da (masalan Payment posting).

### OrderCreate M1 qadamlari (yopiq)

1. Status SSOT + orphan context ✅  
2. `OrderCreateBonusDebt` ✅  
3. `PolkiReturnPolicy` ✅  
4. `OrderCreateDraft` + thin `useOrderCreate` composer ✅  

Composer ~480 LOC; draft facade legacy allowlist.

### StockReservation M1 (yopiq)

1. `stock-reservation.ts` + T2 ✅  
2. orders create/lines/lifecycle ✅  
3. transfers `assertAvailable` ✅  
4. bonus-cap / adjustment ✅  

## Skills — nima o‘rnatilgan

Manba: `mattpocock/skills` @ `5863806dd4e15c63174bee4e7515a4256792ecfa`  
Lock: `skills-lock.json` · Nusxa: `.agents/skills/`

| Skill | Vazifa |
|-------|--------|
| `ask-matt` | Qaysi skill/flow kerak — router |
| `grill-with-docs` | Intervyu + GLOSSARY/ADR |
| `grill-me` | Intervyu (docsiz) |
| `improve-codebase-architecture` | Deepen candidate’lar |
| `implement` | Ticket/spec ni kodlash (+ tdd + code-review) |
| `tdd` | Red→green |
| `code-review` | Standards + Spec ikki o‘q |
| `research` | Primary-source tadqiqot |
| `retro` | Sessiondan environment yaxshilash |

**Hali lock’da yo‘q, lekin flowda tilga olingan:** `/grilling`, `/domain-modeling`, `/codebase-design`, `/to-spec`, `/to-tickets`, `/pr`, `/handoff`, `/prototype` — kerak bo‘lsa `npx skills add mattpocock/skills@…` yoki plugin orqali qo‘shiladi.

## Skills — o‘rnatish ketma-ketligi

1. **Repo ildizida** Cursor Agent Skills / Matt Pocock plugin (yoki `skills` CLI).  
2. **Asosiy to‘plam** (`skills-lock.json` dagi 9 ta) — bir commit hash bilan pin.  
3. **Nusxa** `.agents/skills/<name>/SKILL.md` (va yordamchi md).  
4. **Tekshiruv:** `/ask-matt` ochiladi; `/grill-with-docs` → GLOSSARY; `/implement` → `/tdd` + `/code-review`.  
5. **Ishchi oqim (shu reja uchun):**  
   `improve-codebase-architecture` → tanlov → `grill-with-docs` → (ixtiyoriy `to-spec`/`to-tickets`) → `implement` (TDD) → `code-review` → `retro`.

## Mobil + uyda Git sinxron

- Manba: monorepo `mobile/` (Flutter) — `main` da; `git pull` bilan keladi.
- Skript: ildizda `uyda-yangilash.cmd` → pull + `flutter pub get`.
- Yo‘riqnoma: [docs/UYDA-GIT-SINXRON.md](../UYDA-GIT-SINXRON.md)
- Redesign holat: [mobile/REDESIGN_STATUS.md](../../mobile/REDESIGN_STATUS.md)

## Asosiy hujjatlar

- `GLOSSARY.md` — domain + kelishuvlar  
- `docs/adr/ADR-005` … `ADR-008`  
- `docs/audit/RESEARCH-PROJECT-STATE-2026-11-19.md` — reports/audit snapshot  
