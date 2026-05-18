# OpenAPI / kontrakt strategiyasi (Sprint 4 — qaror)

## Qaror (2026)

**Inkremental code-first**, mavjud arxitekturaga mos:

- Marshrutlarda **Zod** `safeParse` / global `ZodError` handler allaqachon ishlatiladi.
- Umumiy kirish shakllari `backend/src/contracts/` ostida to‘planmoqda (`auth`, path `:id`).
- To‘liq spec-first (YAML → kod) hozircha **tanlanmadi**: ikkala frontend (Next) va backend uchun ikkala generatorni bir vaqtda ushlab turish narxi yuqori.

## Minimal pipeline (mavjud)

| Qadam | Amal |
|-------|------|
| **lint** | `npm run openapi:lint` — `@apidevtools/swagger-cli validate` orqali `openapi/skeleton.yaml` sintaksisi va struktura. |
| **generate** | `npm run openapi:generate` — `zod-to-json-schema` orqali `contracts/` → `openapi/generated/components.json` + `openapi.bundle.yaml`. |
| **diff** | OpenAPI fayllariga tegishli PR larda `git diff main -- backend/openapi/` (yoki `master`). |

Fayllar: `backend/openapi/skeleton.yaml`, `backend/openapi/README.md`. CI: `.github/workflows/ci.yml` — `Validate OpenAPI skeleton`.

## Keyingi bosqich (kengaytirish)

1. **Variant A (tavsiya etiladi):** `@fastify/swagger` + `@fastify/swagger-ui` — marshrutlarga bosqichma-bosqich `schema` qo‘shish yoki mavjud Zod dan JSON Schema generatsiya (`zod-to-json-schema`) bilan bog‘lash.
2. **Variant B:** tashqi `zod-to-openapi` CLI — `contracts/` dan to‘liq `openapi.yaml`; `npx @redocly/cli lint` (ixtiyoriy `redocly.yaml` qoidalari bilan).

To‘liq artefakt avtogeneratsiyasi va kontrakt testlari — keyingi PR.

## Public endpointlar va xato sxemasi

- Har **tag** modul bo‘yicha (`orders`, `clients`, …).
- **4xx/5xx** uchun umumiy tanlov: `error`, `requestId`, `message?`, `details?` — `API_ERROR_CODES.md` bilan bir xil.

## Breaking change siyosasi (qisqa)

| O‘zgarish | Amal |
|-----------|------|
| Yangi ixtiyoriy maydon (response) | Minor, changelog. |
| Yangi majburiy client maydoni yoki response maydonini olib tashlash | **Breaking** — avval deprecation (`sunset` sana yoki versiya prefiks), keyin major. |
| `error` kodi yoki HTTP status semantikasi | Breaking yoki migration qatlami (ikkala kodni vaqtincha qabul qilish). |

URL prefiks: hozir `/api/:slug/...`; versiya prefiksi (`/api/v2/...`) faqat kerak bo‘lganda alohida loyiha sifatida.

## Bog‘liq

- Amaliy xato kontrakti: `API_ERROR_CODES.md`.
- Smoke ro‘yxat (keyinchalik kontrakt testlariga kengaytirish): `backend/tests/contract-smoke.md`.
- OpenAPI skeleton: `backend/openapi/`.
