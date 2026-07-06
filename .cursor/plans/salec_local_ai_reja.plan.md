---
name: SALEC Local AI — lokal o'qitilgan AI tizimi
overview: "SALEC monorepo uchun 100% lokal AI: intent/slot modellar (0 dan oqitish), RBAC bilan orchestrator, ovoz (ASR/TTS), barcha rollar bosqichma-bosqich. Cursor IDE + Claude bilan ishlab chiqish. Tashqi AI API yo'q."
todos:
  - id: ai-plan-file
    content: salec_local_ai_reja.plan.md (ushbu reja hujjati)
    status: completed
  - id: ai-f0-scope
    content: "FAZA 0 — Scope, intent katalogi (35), permission map, xavfsizlik qoidalari, hardware tekshiruv"
    status: pending
  - id: ai-f1-dataset
    content: "FAZA 1 — Dataset: intent 5250+, slot 2000+, FAQ/RAG chunk, negative misollar, train/val/test split"
    status: pending
  - id: ai-f2-train-intent
    content: "FAZA 2a — Intent model oqitish (0 dan), ONNX export, accuracy ≥95%"
    status: pending
  - id: ai-f2-train-slots
    content: "FAZA 2b — Slot/NER model oqitish (0 dan), F1 ≥90%"
    status: pending
  - id: ai-f3-backend
    content: "FAZA 3 — backend/src/modules/ai/ integratsiya, RBAC, tools, audit log, integration testlar"
    status: pending
  - id: ai-f4-voice
    content: "FAZA 4 — Ovoz: Whisper ASR + Piper TTS lokal, ai-service microservice, mobil voice UI"
    status: pending
  - id: ai-f5-frontend
    content: "FAZA 5 — frontend/ chat panel + mobile/ AI tugmasi, tasdiqlash UX"
    status: pending
  - id: ai-f6-roles
    content: "FAZA 6 — Qolgan rollar (expeditor, director, accountant, …) + kunlik digest worker"
    status: pending
  - id: ai-f7-qa-deploy
    content: "FAZA 7 — Xavfsizlik audit, load test, Docker Compose, runbook hujjat"
    status: pending
  - id: ai-f8-faq-llm
    content: "FAZA 8 (ixtiyoriy) — Kichik FAQ LLM (500M–1B), faqat SALEC corpus"
    status: pending
  - id: ai-mvp-done
    content: "MVP qabul mezonlari bajarildi (Hafta ~11): matn, agent+supervisor, 15 intent, RBAC, audit"
    status: pending
  - id: ai-prod-done
    content: "Production qabul mezonlari bajarildi (Hafta ~20): ovoz, 8+ rol, mobil+veb, Docker, runbook"
    status: pending
  - id: ai-project-done
    content: "LOYIHA YAKUNLANDI — barcha majburiy fazalar (0–7) tugallandi, bildirishnoma yozildi"
    status: pending
isProject: true
---

> **📋 REJA HUJJATI HOLATI:** ✅ **TAYYOR** (2026-06-26) — reja yozildi, ishlar hali **boshlanmagan**.  
> **🚧 LOYIHA ISHLARI HOLATI:** ⏳ **KUTILMOQDA** — FAZA 0 dan boshlanadi.  
> Loyiha to‘liq tugaganda ushbu blok **🎉 LOYIHA YAKUNLANDI** ga almashtiriladi (17-bo‘limga qarang).

# SALEC Local AI — to‘liq ishlab chiqish rejasi

**Manba loyiha:** SALEC monorepo — `backend/` (Fastify + PostgreSQL + RBAC), `frontend/` (Next.js), `mobile/` (Flutter)  
**Ish katalogi:** `D:\SALEC — копия`  
**Ishlab chiqish vositalari:** Cursor IDE + Claude (Agent rejimi)  
**Maxfiylik:** 100% lokal — tashqi OpenAI/Claude API **production inferensda ishlatilmaydi**

---

## Navbat buzilmasligi qoidalari (boshqa chat uchun)

1. **Fazalar ketma-ketligi majburiy:** 0 → 1 → 2 → 3 → (4 va 5 parallel mumkin) → 6 → 7. FAZA 8 faqat 0–7 tugagach.
2. **Har chat boshida** ushbu faylni o‘qing; YAML `todos` dagi birinchi `pending` element — keyingi ish.
3. **Faza tugaganda:** tegishli `todo` ni `completed` qiling; faza jadvalidagi holatni ✅ qiling; qabul mezonlari checklistini tekshiring.
4. **MVP alohida:** `ai-mvp-done` todo — FAZA 0–3 + qisman FAZA 5 (Hafta ~11).
5. **Hech qachon** «keyinroq davom ettiramiz» deb yozmang — faqat aniq holat: **TUGALLANDI** yoki **KUTILMOQDA** yoki **JARAYONDA**.

---

## 1. Loyiha maqsadi

**SALEC Local AI** — 5 qatlamli maxfiy yordamchi tizim:

| Qatlam | Vazifa | 0 dan oqitish |
|--------|--------|---------------|
| L1 Intent Router | Buyruq/savol turini aniqlash | ✅ Ha |
| L2 Slot/NER | Agent kodi, sana, mijoz, summa | ✅ Ha |
| L3 Orchestrator | RBAC + mavjud SALEC API | TypeScript kod |
| L4 Voice | ASR + TTS (lokal inferens) | Adapter + domain |
| L5 Xulosa | KPI → matn/ovoz | Qoidalar + ixtiyoriy seq2seq |

**Emas:** GPT-4 darajasida foundation LLM ni random weights dan oqitish.  
**Ha:** SALEC uchun tor, ishonchli, RBAC bilan himoyalangan yordamchi.

---

## 2. Arxitektura

```
frontend/ + mobile/
       │ JWT (mavjud auth)
       ▼
backend/src/modules/ai/
  ai.route.ts          POST /api/:slug/ai/command
  ai.voice.route.ts    audio → ASR
  ai.rbac.ts           intent → permission map
  ai.orchestrator.ts   intent → tool → javob
  ai.tools/            dashboard, reports, mobile API wrapper
  ai.audit.ts          har buyruq log
       │
       ├──► PostgreSQL (+ pgvector RAG ixtiyoriy)
       └──► ai-service/ (Python, localhost)
              intent_model.onnx
              slots_model.onnx
              whisper (ASR)
              piper (TTS)
```

**Yangi papkalar (reja):**

| Papka | Maqsad |
|-------|--------|
| `ai-service/` | Python oqitish + inferens microservice |
| `backend/src/modules/ai/` | Fastify integratsiya |
| `datasets/salec-ai/` | Intent/slot/voice dataset (sensitive qism `.gitignore`) |
| `docs/SALEC_LOCAL_AI_RUNBOOK.md` | FAZA 7 da yaratiladi |

**Mavjud kod bilan integratsiya:**

- RBAC: `backend/src/modules/access/rbac.resolve.ts` → `resolveUserPermissionKeys`
- Rollar: `backend/src/modules/access/role-permission-presets.ts`
- Dashboard: `backend/src/modules/dashboard/`
- Hisobotlar: `backend/src/modules/reports/`
- Mobil agent KPI: `mobile/lib/features/agent/home/`

---

## 3. Rollar va bosqichlar

| Bosqich | Rollar | Qachon |
|---------|--------|--------|
| MVP | `agent`, `supervisor` | FAZA 0–3, ~Hafta 11 |
| v1.1 | `expeditor`, `manager` | FAZA 6 |
| v1.2 | `director`, `accountant`, `operator` | FAZA 6 |
| v2.0 | Qolgan preset rollar | FAZA 6 kengaytma |

---

## 4. Umumiy muddat (3 senariy)

| Senariy | Shartlar | Muddat | Buffer bilan |
|---------|----------|--------|--------------|
| Optimistik | 1 dev, GPU bor, dataset tez | 14 hafta | 16 hafta |
| **Realistik ⭐** | 1 dev, Claude, CPU/GPU aralash | **18 hafta** | **22 hafta** |
| Pessimistik | GPU yo‘q, dataset sekin | 26 hafta | 32 hafta |

**Birinchi demo (MVP):** ~Hafta 11  
**Production-ready:** ~Hafta 20  
**Buffer (+22%):** ~Hafta 22

---

## 5. FAZA 0 — Tayyorgarlik va scope

**Muddat:** 1–1.5 hafta  
**Todo id:** `ai-f0-scope`  
**Holat:** ⏳ KUTILMOQDA

### Ishlar

- [ ] 35 ta intent ro‘yxati (MVP uchun 15 ta ajratilgan — 6-bo‘lim)
- [ ] Har intent uchun permission map (`dashboard.prodazhi.view`, `orders.view`, …)
- [ ] Xavfsizlik qoidalari: qaysi intent **tasdiqlash** talab qiladi
- [ ] Hardware tekshiruv (RAM, GPU, disk) — natija jadvalga yoziladi
- [ ] `ai-service/` papka strukturasi
- [ ] Intent → destructive action map (buyurtma yaratish = tasdiqlash majburiy)

### Cursor + Claude topshiriqlari

```
SALEC backend ga modules/ai arxitektura reja yoz.
Mavjud rbac.resolve.ts va dashboard.service.ts dan foydalan.
Intent → permission map jadvali chiqar (35 intent).
```

### Qabul mezonlari (FAZA 0 TUGALLANDI deb yozish uchun)

- [ ] `docs/SALEC_LOCAL_AI_SCOPE.md` yoki ushbu faylga intent jadvali to‘ldirilgan
- [ ] Permission map har intent uchun tasdiqlangan
- [ ] Hardware minimal talablar qayd etilgan

### FAZA 0 yakunlash protokoli

FAZA 0 tugagach, chatda aniq yozing:

> **FAZA 0 TUGALLANDI.** Keyingi ish: FAZA 1 — Dataset.

---

## 6. FAZA 1 — Dataset

**Muddat:** 4–5 hafta  
**Todo id:** `ai-f1-dataset`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 0 ✅

### Dataset hajmi

| Dataset | Hajm | Manba |
|---------|------|-------|
| Intent matn | 35 × 150 = **5 250** | Claude generatsiya + qo‘lda tahrir |
| Slot annotation | **2 000** | Claude + manual |
| Ovoz (MVP+) | **20 soat** | 2–3 agent ovozi |
| FAQ/RAG chunk | **200–400** paragraf | `.md`, RBAC docs |
| Negative | **500** | Noto‘g‘ri buyruqlar |

### Fayl struktura

```
datasets/salec-ai/v1/
  intents.json
  slots.jsonl
  train.jsonl / val.jsonl / test.jsonl
  README.md
```

### Qabul mezonlari

- [ ] Train/val/test = 80/10/10
- [ ] Haqiqiy mijoz nomlari yo‘q (anonymized)
- [ ] O‘zbek + rus aralash ≥ 40% har intentda
- [ ] `datasets/salec-ai/.gitignore` sensitive qism uchun

### FAZA 1 yakunlash protokoli

> **FAZA 1 TUGALLANDI.** Keyingi ish: FAZA 2 — Model oqitish.

---

## 7. FAZA 2 — Modellarni oqitish (0 dan)

**Muddat:** 2–2.5 hafta  
**Todo id:** `ai-f2-train-intent`, `ai-f2-train-slots`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 1 ✅

### L1 Intent model

- Arxitektura: TinyTransformer (~5M) yoki DistilBERT-size (~25M)
- Framework: PyTorch → ONNX
- Maqsad: accuracy **≥ 95%**, inferens **< 50ms**

### L2 Slot model

- BIO tagging: agent_code, client_id, date, amount
- Maqsad: F1 **≥ 90%**

### Fayllar

```
ai-service/
  train_intent.py
  train_slots.py
  evaluate.py
  export_onnx.py
models/
  intent-v1.onnx
  slots-v1.onnx
  metrics.json
```

### Hardware

| Konfig | Oqitish vaqti |
|--------|---------------|
| 16 GB RAM, CPU | 4–12 soat |
| RTX 3060 12GB | 30–90 daqiqa |

### Qabul mezonlari

- [ ] Test set intent accuracy ≥ 95%
- [ ] Test set slot F1 ≥ 90%
- [ ] `metrics.json` saqlangan
- [ ] ONNX backend dan chaqiriladi (smoke test)

### Muammo bo‘lsa (buffer)

- Accuracy < 90% → +1 hafta augmentation, qayta oqitish
- GPU yo‘q → CPU oqitish (+3–5 kun)

### FAZA 2 yakunlash protokoli

> **FAZA 2 TUGALLANDI.** Keyingi ish: FAZA 3 — Backend integratsiya.

---

## 8. FAZA 3 — Backend integratsiya

**Muddat:** 4–5 hafta  
**Todo id:** `ai-f3-backend`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 2 ✅

### Yaratiladigan modullar

```
backend/src/modules/ai/
  ai.route.ts
  ai.voice.route.ts
  ai.rbac.ts
  ai.orchestrator.ts
  ai.audit.ts
  ai.types.ts
  ai.tools/
    agent-daily.ts
    supervisor-kpi.ts
    orders-list.ts
    sync-status.ts
    reports-query.ts
```

### RBAC qoidasi (majburiy)

```typescript
// Har tool chaqiruvdan oldin:
const allowed = await resolveUserPermissionKeys(tenantId, userId, role);
if (!intentPermissions.every(p => allowed.has(p))) {
  return 403; // "Ruxsat yo'q"
}
```

### Ulanadigan API lar

- `getSupervisorSummary`, `getDashboardStats`
- `reports/agent-orders`, `reports/visit-totals`
- `GET /api/:slug/access/me-permissions`
- Mobil sync holati (mavjud mobile API)

### Testlar

- [ ] `tests/ai-rbac.integration.test.ts`
- [ ] Agent supervisor KPI **ololmasligi**
- [ ] Supervisor ola **olishi**
- [ ] Cross-tenant izolyatsiya

### Qabul mezonlari

- [ ] `POST /api/:slug/ai/command` ishlaydi
- [ ] 15 MVP intent matn orqali javob beradi
- [ ] Audit log har so‘rov yoziladi
- [ ] Tashqi AI API chaqiruvi yo‘q

### FAZA 3 yakunlash protokoli

> **FAZA 3 TUGALLANDI.** MVP demosi mumkin. Keyingi: FAZA 4 (ovoz) va FAZA 5 (UI) parallel.

**MVP milestone:** `ai-mvp-done` todo ni `completed` qiling (13-bo‘lim checklist).

---

## 9. FAZA 4 — Ovoz zanjiri

**Muddat:** 3–4 hafta  
**Todo id:** `ai-f4-voice`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 3 ✅ (FAZA 5 bilan parallel mumkin)

### Stack (100% lokal)

| Komponent | Texnologiya |
|-----------|-------------|
| ASR | Whisper small (GGML / whisper.cpp) |
| Hotwords | A-047, vizit, sync, konsignatsiya |
| TTS | Piper (ru; uz ixtiyoriy) |
| Service | `ai-service/asr_server.py` (FastAPI :8091) |

### Oqim

```
Audio → Whisper → matn → intent model → orchestrator → TTS → audio
```

### Mobil

- `mobile/lib/features/ai/` — voice button, wav upload, TTS play
- Xavfli intentlar: ekranda tasdiqlash majburiy

### Qabul mezonlari

- [ ] «Bugungi hisobot» ovozda ishlaydi (agent roli)
- [ ] Internet o‘chirilgan holda inferens ishlaydi
- [ ] iOS + Android mikrofon permission

### FAZA 4 yakunlash protokoli

> **FAZA 4 TUGALLANDI.**

---

## 10. FAZA 5 — Frontend UI

**Muddat:** 3 hafta (FAZA 3–4 bilan parallel)  
**Todo id:** `ai-f5-frontend`  
**Holat:** ⏳ KUTILMOQDA

### Veb (`frontend/`)

- [ ] `/ai-assistant` — chat panel, rol badge
- [ ] 403 xabarlari foydalanuvchiga tushunarli
- [ ] Dashboard widget: kunlik AI xulosa (ixtiyoriy)

### Mobil (`mobile/`)

- [ ] Agent/supervisor app bar da AI tugmasi
- [ ] Matn + ovoz rejimi
- [ ] Tasdiqlash bottom sheet

### Qabul mezonlari

- [ ] Veb va mobil UI mavjud `agent_ui` / veb dizayniga mos
- [ ] RBAC xato holati ko‘rsatiladi

### FAZA 5 yakunlash protokoli

> **FAZA 5 TUGALLANDI.**

---

## 11. FAZA 6 — Qolgan rollar + proaktiv nazorat

**Muddat:** 3 hafta  
**Todo id:** `ai-f6-roles`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 3 ✅

### Rollar

- [ ] `expeditor` — yetkazishlar, to‘lov holati
- [ ] `director`, `accountant`, `operator`
- [ ] Qolgan preset rollar (kerak bo‘yicha)

### Proaktiv worker

```
backend/src/worker/ai-daily-digest.ts
  → kunlik 18:00 (tenant timezone)
  → KPI xulosa
  → push/FCM (mavjud tizim)
```

### Anomaly qoidalari

- Sync 24s+ kechikdi
- Reja < 50% soat 15:00 da
- Oflayn navbat > 5

### FAZA 6 yakunlash protokoli

> **FAZA 6 TUGALLANDI.**

---

## 12. FAZA 7 — Xavfsiylik, test, production

**Muddat:** 2–3 hafta  
**Todo id:** `ai-f7-qa-deploy`  
**Holat:** ⏳ KUTILMOQDA  
**Bog‘liqlik:** FAZA 4, 5, 6 ✅

### Testlar

- [ ] RBAC integration 100% pass
- [ ] 35 intent smoke test
- [ ] Penetratsiya: AI orqali boshqa tenant ma’lumoti **imkonsiz**
- [ ] Load: 50 parallel so‘rov < 2s (CPU rejimida maqsad)

### Deploy

- [ ] Docker Compose: `ai-service` + backend
- [ ] `AI_ENABLED=1`, `AI_SERVICE_URL=http://ai-service:8091`
- [ ] Model weights volume (git emas)

### Hujjat

- [ ] `docs/SALEC_LOCAL_AI_RUNBOOK.md` yozildi

### Qabul mezonlari (Production)

- [ ] 8+ rol qo‘llab-quvvatlanadi
- [ ] Ovoz + matn ishlaydi
- [ ] Runbook mavjud
- [ ] `ai-prod-done` todo `completed`

### FAZA 7 yakunlash protokoli

> **FAZA 7 TUGALLANDI.** Majburiy ishlar tugadi. FAZA 8 ixtiyoriy.

**Production milestone:** `ai-prod-done` todo ni `completed` qiling.

---

## 13. FAZA 8 — Ixtiyoriy FAQ LLM

**Muddat:** +4 hafta  
**Todo id:** `ai-f8-faq-llm`  
**Holat:** ⏳ KUTILMOQDA (ixtiyoriy)  
**Bog‘liqlik:** FAZA 0–7 ✅

- 500M–1B param, faqat SALEC FAQ corpus
- GPU deyarli majburiy
- **MVP uchun shart emas**

### FAZA 8 yakunlash protokoli

> **FAZA 8 TUGALLANDI** (agar bajarilsa).

---

## 14. MVP intent katalogi (15 ta — birinchi navbat)

| ID | Intent | Rol | Permission | Tasdiqlash |
|----|--------|-----|------------|------------|
| I01 | `daily_report_self` | agent | dashboard.prodazhi.view | Yo‘q |
| I02 | `visit_progress` | agent | clients.view | Yo‘q |
| I03 | `sync_status` | agent, expeditor | mobile sync | Yo‘q |
| I04 | `pending_orders_count` | agent | orders.create | Yo‘q |
| I05 | `client_search` | agent | clients.view | Yo‘q |
| I06 | `debtors_list` | agent | clients.view | Yo‘q |
| I07 | `warehouse_stock` | agent | warehouse.view | Yo‘q |
| I08 | `supervisor_team_kpi` | supervisor | dashboard.* | Yo‘q |
| I09 | `supervisor_agent_kpi` | supervisor | staff.agent.view | Slot: agent_code |
| I10 | `supervisor_visits_today` | supervisor | dashboard.supervayzer | Yo‘q |
| I11 | `orders_today` | agent, supervisor | orders.view | Yo‘q |
| I12 | `help_how_to` | barcha | — | FAQ/RAG |
| I13 | `unknown` | barcha | — | «Tushunmadim» |
| I14 | `navigate_screen` | agent | — | UI only |
| I15 | `report_anomaly_check` | supervisor, director | dashboard.view | Yo‘q |

**Qolgan 20 intent:** FAZA 6 da qo‘shiladi.

---

## 15. Xavflar va buffer

| # | Xavf | Ehtimol | Qoʻshimcha vaqt |
|---|------|---------|-----------------|
| R1 | Intent accuracy past | O‘rta | +1–2 hafta |
| R2 | GPU yo‘q | Yuqori | +1 hafta |
| R3 | Ovoz shovqin | O‘rta | Matn fallback |
| R4 | RBAC bypass | Past | +1 hafta (kritik) |
| R5 | Claude kod xato | O‘rta | +3–5 kun |
| R6 | Scope creep | Yuqori | FAZA 8 alohida |
| R7 | 1 dev band | Yuqori | +2–4 hafta |
| R8 | O‘zbek ASR zaif | Yuqori | Rus buyruq +1 hafta |

**Umumiy buffer:** 18 → **22 hafta** (+22%).

---

## 16. Vaqt chizig‘i (Gantt)

```
Hafta:  1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20   21-24
        ├F0──┤
             ├────────── F1 Dataset ──────────┤
                                    ├─ F2 ─┤
                                         ├──────── F3 Backend ────────┤
                                              ├──── F5 UI ────┤
                                                         ├──── F4 Voice ────┤
                                                                    ├─ F6 ─┤
                                                                               ├─ F7 ─┤
                                                                                         ├─ F8 opt ─┤

MVP demo:        ~ Hafta 11
Production:      ~ Hafta 20
Buffer:          ~ Hafta 22
```

---

## 17. LOYIHA YAKUNLANISH PROTOKOLI

### Majburiy ishlar tugaganda (FAZA 0–7)

1. Ushbu fayl boshidagi holat blokini quyidagiga almashtiring:

```markdown
> **🎉 LOYIHA YAKUNLANDI (SANA: YYYY-MM-DD)**
> SALEC Local AI — barcha majburiy fazalar (0–7) tugallandi.
> Bildirishnoma: docs/SALEC_LOCAL_AI_YAKUNLANDI.md
```

2. YAML todos: `ai-f0-scope` … `ai-f7-qa-deploy`, `ai-mvp-done`, `ai-prod-done`, `ai-project-done` — hammasi `status: completed`.

3. `docs/SALEC_LOCAL_AI_YAKUNLANDI.md` yarating (namuna: `YAKUNLANDI_REJALAR_BILDIRISHNOMA_2026-06-26.md`).

4. Chatda **faqat** quyidagini yozing (boshqa gap qo‘shmasdan):

> **SALEC Local AI loyihasi to‘liq tugallandi.** Barcha majburiy fazalar (0–7) bajarildi. Reja fayli: `.cursor/plans/salec_local_ai_reja.plan.md`. Bildirishnoma: `docs/SALEC_LOCAL_AI_YAKUNLANDI.md`.

### Faqat reja hujjati tugaganda (hozirgi holat)

> **Reja hujjati to‘liq tayyor va yakunlandi.** Ishlar FAZA 0 dan boshlanishi kerak. Loyiha ishlari hali boshlanmagan.

---

## 18. Qabul mezonlari jadvali (yakuniy checklist)

### MVP (`ai-mvp-done`)

- [ ] 15 intent matn orqali ishlaydi
- [ ] Agent + supervisor rollari
- [ ] 403 noto‘g‘ri ruxsatda
- [ ] Audit log
- [ ] Tashqi AI API yo‘q
- [ ] Intent accuracy ≥ 93% test setda

### Production (`ai-prod-done`)

- [ ] MVP barcha punktlari
- [ ] Ovoz ASR + TTS lokal
- [ ] 8+ rol
- [ ] Mobil + veb UI
- [ ] Docker Compose
- [ ] Runbook hujjat
- [ ] RBAC integration test 100%

### Loyiha (`ai-project-done`)

- [ ] Production barcha punktlari
- [ ] FAZA 0–7 todos `completed`
- [ ] Bildirishnoma hujjati yozilgan
- [ ] Ushbu reja fayli boshidagi holat **🎉 LOYIHA YAKUNLANDI**

---

## 19. Xarajat (taxmin)

| Modda | Summa |
|-------|-------|
| Dasturiy (PyTorch, Whisper, Piper) | $0 |
| Cursor Pro (~5 oy) | ~$100 |
| GPU (agar yo‘q bo‘lsa) | $0–1200 |
| **Minimal jami** | **~$100–200** |

---

## 20. Cursor Agent topshiriq shablonlari (har faza)

**FAZA 0:**
> SALEC backend ga `modules/ai` arxitektura yoz. `rbac.resolve.ts` va `dashboard.service.ts` dan foydalan. 35 intent permission map.

**FAZA 1:**
> `datasets/salec-ai/intents.json` — 35 intent × 150 o‘zbek/rus misol, anonymized.

**FAZA 3:**
> `ai.route.ts`: JWT, ensureTenantContext, resolveUserPermissionKeys, localhost:8091 intent call. Tool: agent daily KPI.

**FAZA 4:**
> Flutter `features/ai/voice_command_button.dart` — mikrofon, wav, TTS javob.

**FAZA 7:**
> `tests/ai-rbac.integration.test.ts` — agent supervisor KPI ololmasligi.

---

## 21. Hozirgi holat jadvali

| Faza | Todo id | Holat | Tugash sanasi |
|------|---------|-------|---------------|
| Reja hujjati | `ai-plan-file` | ✅ TUGALLANDI | 2026-06-26 |
| FAZA 0 | `ai-f0-scope` | ⏳ KUTILMOQDA | — |
| FAZA 1 | `ai-f1-dataset` | ⏳ KUTILMOQDA | — |
| FAZA 2a | `ai-f2-train-intent` | ⏳ KUTILMOQDA | — |
| FAZA 2b | `ai-f2-train-slots` | ⏳ KUTILMOQDA | — |
| FAZA 3 | `ai-f3-backend` | ⏳ KUTILMOQDA | — |
| FAZA 4 | `ai-f4-voice` | ⏳ KUTILMOQDA | — |
| FAZA 5 | `ai-f5-frontend` | ⏳ KUTILMOQDA | — |
| FAZA 6 | `ai-f6-roles` | ⏳ KUTILMOQDA | — |
| FAZA 7 | `ai-f7-qa-deploy` | ⏳ KUTILMOQDA | — |
| FAZA 8 (ixtiyoriy) | `ai-f8-faq-llm` | ⏳ KUTILMOQDA | — |
| MVP milestone | `ai-mvp-done` | ⏳ KUTILMOQDA | — |
| Production milestone | `ai-prod-done` | ⏳ KUTILMOQDA | — |
| **LOYIHA YAKUNI** | `ai-project-done` | ⏳ KUTILMOQDA | — |

---

**Reja hujjati to‘liq tayyor va yakunlandi.**  
Keyingi ish: **FAZA 0** (`ai-f0-scope`) — boshqa chatda ham shu fayldan davom eting; navbat buzilmaydi.
