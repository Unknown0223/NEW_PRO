# AI Assistant — LLM ulash va mukammallashtirish rejasi

> **Holat (2026-11-12):** `(2).patch` loyihaga qo‘llangan — rules-based NLU + allow-list tool’lar + web chat (`/assistant`).  
> **LLM chaqiruv kodi hali yo‘q** (faqat docs/tip: `source: "rules" | "llm"`).  
> **Maqsad:** uy kompyuterida (LLM ishlaydigan muhitda) API key / LM Studio orqali tushunishni yaxshilash — xavfsizlikni buzmasdan.

---

## 1. Nima allaqachon bor (MVP)

| Qism | Holat |
|------|--------|
| Backend `backend/src/modules/ai/*` | ✅ |
| HTTP: `/ai/ask`, `/ai/confirm`, `/ai/capabilities`, `/ai/examples`, `/ai/exports/:token` | ✅ |
| Rules intent + dates + plan + guard + inject | ✅ |
| ~31 read + ~10 write tool (preview→confirm) | ✅ |
| Web UI `/assistant` | ✅ |
| Docs: `AI_ASSISTANT_ARCHITECTURE.md`, `AI_ASSISTANT_CAPABILITIES.md` | ✅ |
| Pure testlar `backend/tests/ai-*.pure.test.ts` | ✅ |
| **LLM client (`ASSISTANT_API_KEY` / LM Studio)** | ❌ hali implement qilinmagan |

**Muhim:** API key qo‘yilsa ham, LLM **faqat JSON plan** taklif qiladi. DB/SQL/ixtiyoriy URL yo‘q. Registrga mos kelmasa — rules fallback.

---

## 2. LLM nima qiladi / qilmaydi

### Qiladi
- Erkin savolni tushunib: `{ "intent": "...", "params": { ... } }` chiqaradi
- Typo, sinonim, aralash uz/ru gaplarni yaxshiroq ajratadi
- Yetishmayotgan slotlarni so‘rash uchun `missing` / clarifying matn taklif qilishi mumkin (validatsiyadan keyin)

### Qilmaydi
- O‘zi API chaqirmaydi (faqat `ai.exec` / inject)
- Yangi tool uydirmaydi
- O‘chirish / RBAC bypass
- Javob matnini «ixtiyoriy uydirma» qilib yozmaydi — natija tool’dan keladi

---

## 3. Env (uy kompyuter)

```env
# Kill-switch
AI_ASSISTANT_ENABLED=1
AI_WRITE_ENABLED=1

# LLM (ixtiyoriy — bo‘lmasa rules ishlaydi)
ASSISTANT_API_KEY=sk-...                 # OpenAI-compatible
ASSISTANT_API_BASE=https://api.openai.com/v1   # yoki LM Studio
# LM Studio misol:
# ASSISTANT_API_BASE=http://127.0.0.1:1234/v1
# ASSISTANT_API_KEY=lm-studio
ASSISTANT_MODEL=gpt-4o-mini              # yoki lokal model nomi
ASSISTANT_LLM_TIMEOUT_MS=20000
ASSISTANT_LLM_MAX_TOKENS=800
```

LM Studio: Server → Start → OpenAI-compatible endpoint.

---

## 4. Implementatsiya bosqichlari (uyda)

### Bosqich A — `ai.llm.ts` (yangi fayl, ≤400 loc)
1. `isLlmConfigured()` — `ASSISTANT_API_BASE` + key/model
2. `proposePlanFromLlm(question, catalog)` → `Promise<{ intent, params } | null>`
3. OpenAI Chat Completions (`/chat/completions`), `response_format: json_object` (qo‘llab-quvvatlansa)
4. System prompt: faqat allow-list intent’lar ro‘yxati + slot sxemasi + «JSON only»
5. Timeout + xato → `null` (rules’ga qaytish)
6. Hech qachon user JWT / parol / PINFL ni LLM’ga yubormang

### Bosqich B — `ai.plan.ts` / `ai.route.ts` ulash
1. `planFromQuestion` oldidan yoki ichida:
   - rules plan = fallback
   - agar LLM configured → LLM plan
   - `verify` / registry: noma’lum intent/tool → rad, rules ishlat
2. `BuiltPlan.source = "llm" | "rules"`
3. Audit: `detail.nlu_source`

### Bosqich C — System prompt katalogi
1. Intent + qisqa tavsif + majburiy/ixtiyoriy params (registrdan generate)
2. Bugungi sana (Asia/Tashkent) promptga
3. Misollar: 5–10 ta few-shot (savdo, qarz, ombor, narx preview)

### Bosqich D — Testlar
1. `ai-llm.pure.test.ts` — JSON parse, reject unknown intent, timeout mock
2. Integration (ixtiyoriy): LM Studio yoqilganda smoke

### Bosqich E — UI / UX
1. `/assistant` xato matni: «AI kaliti» o‘rniga aniq sabab (`getUserFacingError`)
2. Capabilities’da: «LLM: yoqilgan/o‘chirilgan» (faqat admin)
3. Confirm oqimi o‘zgarmasin

### Bosqich F — Tekshiruv checklist (smoke)
1. Kalitsiz: «shu oy savdo» → rules ishlaydi  
2. Kalit bilan: «o‘tgan oyda eng ko‘p sotgan agentlar kim?» → llm plan → tool  
3. Noma’lum: «ob-havo qanday?» → help / rad, tool chaqirilmasin  
4. Agent roli: boshqa agent ma’lumoti → denied  
5. «SKU narxini X qil» → preview → confirm  
6. Export Excel  

---

## 5. Tavsiya etilgan fayllar

| Fayl | Ish |
|------|-----|
| `backend/src/modules/ai/ai.llm.ts` | **YANGI** — HTTP client + prompt |
| `backend/src/modules/ai/ai.config.ts` | env getter’lar |
| `backend/src/modules/ai/ai.plan.ts` | LLM → verify → fallback |
| `backend/src/modules/ai/ai.route.ts` | ask oqimida source |
| `backend/tests/ai-llm.pure.test.ts` | **YANGI** |
| `docs/AI_ASSISTANT_CAPABILITIES.md` | LLM bo‘limi yangilash |
| `frontend/.../assistant/page.tsx` | xato matni |

---

## 6. Xavfsizlik (buzilmasin)

1. LLM javobi **faqat** registry intent/tool  
2. Parametrlar Zod/`ai.verify` orqali  
3. Write hali ham preview → confirm  
4. Self-scope rollar (`agent`…) majburiy  
5. Promptga secrets yo‘q  
6. Rate limit saqlansin  
7. Fail-open emas: LLM o‘chsa yoki xato qilsa — **rules**, xavfli default yo‘q  

---

## 7. Keyingi (LLM’dan keyin, ixtiyoriy)

- Mobil chat ekrani  
- Qo‘shimcha tool’lar (to‘lov yozish, plan setup ko‘rish, …) — alohida checklist  
- `write.order_status` path: realda `PATCH /orders/:id/status` ekanini smoke qilish  
- Intent chalkashligi: `tabel.list` vs `tabel.marks` tozalash  

---

## 8. Uyda ish tartibi (qisqa)

```text
1) git pull
2) LM Studio yoki OpenAI key → .env
3) ai.llm.ts yozish + plan/route ulash
4) npm test — ai-* 
5) lokal: frontend + backend, /assistant dan 6 ta smoke
6) commit: "feat(ai): optional LLM plan via ASSISTANT_API_KEY"
7) deploy (ixtiyoriy) — prod’da key bo‘lmasa rules qoladi
```

---

## 9. Muvaffaqiyat mezonlari

- [ ] Key **yo‘q**: hozirgi MVP o‘zgarmagan holda ishlaydi  
- [ ] Key **bor**: murakkabroq savollar to‘g‘ri tool’ga tushadi  
- [ ] Noma’lum intent LLM’dan kelsa — bajarilmaydi  
- [ ] Write confirmsiz bajarilmaydi  
- [ ] Agent scope buzilmaydi  
- [ ] Auditda `nlu_source: llm|rules` ko‘rinadi  

---

*Bu hujjat uy kompyuterida LLM ulash uchun asosiy reja. Kodni shu tartibda yozing; parallel yangi “AI engine” uydirmang.*
