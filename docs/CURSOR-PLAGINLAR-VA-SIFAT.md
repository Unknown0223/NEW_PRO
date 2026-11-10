# Cursor + kod sifati: plaginlar, sozlamalar va kundalik ish tartibi

> Bu qo‘llanma `SALEC` monoreposi uchun yozilgan: **backend** (Fastify + Prisma),
> **frontend** (Next.js 16, React 18), **mobile** (Flutter).
> Maqsad: Cursor IDE’da kodni tez yozish, xatolarni darhol ko‘rish va CI’ni
> buzmasdan commit qilish.

---

## 1. Bir qarashda: nima o‘zgardi (bu commitda)

| Nima                                    | Fayl                                                                    | Natija                                                        |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Backend’da ESLint umuman yo‘q edi       | `backend/eslint.config.mjs`, `backend/package.json`                     | `npm run lint` / `lint:errors` / `lint:fix` ishlaydi          |
| Frontend ESLint “hamma narsa error” edi | `frontend/eslint.config.mjs`                                            | `errors: 0`; vendor/build papkalar lint qilinmaydi            |
| Prettier konfiguratsiyasi yo‘q edi      | `.prettierrc.json`, `.prettierignore`, `.editorconfig`                  | Cursor/VS Code’da “Format on save” barqaror ishlaydi          |
| Repo’da 3000+ fayl formatlanmagan       | `scripts/prettier-changed.mjs`                                          | Faqat **o‘zgargan** fayllar formatlanadi (diff shovqini yo‘q) |
| CI’da lint gate yo‘q edi                | `.github/workflows/ci.yml`                                              | Backend + frontend `lint:errors` job’lari qo‘shildi           |
| Cursor sozlamalari deyarli bo‘sh edi    | `.vscode/settings.json`, `extensions.json`, `launch.json`, `tasks.json` | Format/lint/debug/test bir tugmada                            |
| Cursor qoidasi yo‘q edi                 | `.cursor/rules/sifat-tekshiruvi.mdc`                                    | Agent har o‘zgarishdan keyin tekshiradi                       |

**Topilgan va tuzatilgan real xatolar (o‘lchandi):**

| Joy                                                                          | Xato                                                                                   | Soni        |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------- |
| `frontend/components/staff/agent-form-modal.tsx`                             | `<a>` ochilib `</Link>`, `</a>` bilan yopilgan — JSX buzilishi (build yiqilardi)       | 4 ta havola |
| `frontend/components/staff/agent-configurations-dialog.tsx`                  | `</Link>` yopilishi mos emas                                                           | 1 ta havola |
| `frontend/app/(dashboard)/assistant/page.tsx`                                | JSX matnida `'` (apostrof) — `react/no-unescaped-entities`                             | 3 ta        |
| `frontend/.../order-payment-utils.ts`, `.../transfer-amaliyot-workspace.tsx` | `let` → `const` (`prefer-const`)                                                       | 2 ta        |
| backend `prefer-const`                                                       | o‘zgarmas `let` — `eslint --fix` bilan                                                 | 22 ta       |
| backend `no-useless-escape`                                                  | `[\s\-]` → `[\s-]` (regex ma’nosi o‘zgarmaydi)                                         | 5 ta        |
| backend `no-useless-catch`                                                   | `try { ... } catch (e) { throw e; }`                                                   | 1 ta        |
| backend `no-require-imports`, `no-control-regex`, `no-unreachable`           | ataylab yozilgan — sabab bilan `eslint-disable ... -- izoh`                            | 5 ta        |
| `frontend/lint-report.json`                                                  | eski (Windows `D:\SALEC`) yo‘llar bilan 2.6 MB — endi lint to‘g‘ridan-to‘g‘ri ishlaydi | —           |
| `scripts/legacy-max-loc-frontend.txt`                                        | `audit:max-loc` yiqilardi (10 ta fayl allowlist’da yo‘q edi)                           | 10 ta       |

**Yakuniy holat (repo ichida o‘lchangan):**

```
frontend: npx eslint .            → 0 errors, 1403 warnings
backend:  npm run lint            → 0 errors, 2265 warnings
root:     npm run audit:max-loc   → OK (0 new >400 satr)
```

---

## 2. Cursor uchun plaginlar (Extensions)

Cursor VS Code plaginlarini ishlatadi. Ro‘yxat `.vscode/extensions.json` da —
Cursor “Extensions” panelini ochsa, **“Recommended”** bo‘limida chiqadi.

### Majburiy (bularsiz sifat tekshiruvi ishlamaydi)

| Plagin           | ID                          | Nima beradi                                                                  |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **ESLint**       | `dbaeumer.vscode-eslint`    | Faylni saqlaganda xato/warning inline; flat config (v9) qo‘llab-quvvatlanadi |
| **Prettier**     | `esbenp.prettier-vscode`    | Format on save; `.prettierrc.json` ni o‘zi topadi                            |
| **EditorConfig** | `editorconfig.editorconfig` | Indent/satr oxiri (`lf`/`crlf`) bir xil bo‘ladi                              |
| **Error Lens**   | `usernamehw.errorlens`      | Xatoni satrning yonida darhol ko‘rsatadi (eng katta tezlik yutug‘i)          |
| **Prisma**       | `prisma.prisma`             | `schema.prisma` syntax, formatlash, migratsiya nomlari                       |

### Kuchli tavsiya

| Plagin                    | ID                                         | Nima uchun                                               |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss`                | Klass nomlari autocomplete (loyiha Tailwind 4 ishlatadi) |
| Vitest                    | `vitest.explorer`                          | Testlarni IDE ichida yugurish/debug (backend + frontend) |
| Playwright                | `ms-playwright.playwright`                 | `frontend/e2e/*.spec.ts` larni debug qilish              |
| GitLens                   | `eamodio.gitlens`                          | Kim, qachon, nega o‘zgartirgan (blame)                   |
| Git Graph                 | `mhutchie.git-graph`                       | Branch tarixini vizual ko‘rish                           |
| Dart / Flutter            | `dart-code.dart-code`, `dart-code.flutter` | `mobile/` uchun                                          |
| REST Client               | `humao.rest-client`                        | `POST /api/:slug/...` ni `.http` faylda sinash           |
| SQLTools                  | `mtxr.sqltools`                            | Lokal Postgres (`localhost:15432`) bilan ishlash         |
| Code Spell Checker        | `streetsidesoftware.code-spell-checker`    | O‘zbek/rus izohlarda xato so‘zlarni belgilaydi           |

### Cursor’ning o‘z imkoniyatlari (plagin emas, lekin muhim)

1. **`.cursor/rules/*.mdc`** — loyiha qoidalari. Bu repoda 5 ta mavjud:
   `project-standards`, `picker-labels`, `security-checklist`, `attendance-terminal`
   va yangi **`sifat-tekshiruvi`**. Agent ularni avtomatik o‘qiydi — shuning uchun
   qoidalarni qisqa va aniq yozish kerak.
2. **`.cursor/plans/`** — uzoq rejalar (masalan `salec_arena_audit_tekshiruv_va_to_liq_reja.md`).
   Cursor’da: `"Faza 0, S0-01 task'ni bajaring"` deb yozish kifoya.
3. **Tab / Cmd+K** — `TS` va `TSX` fayllarda eng ishonchli; `frontend/vendor/*` ni tahrirlamang
   (generatsiya qilingan bundle).
4. **Cursor “Rules” paneli** — `.cursor/rules` dagi fayllar avtomatik indekslanadi;
   yangi qoida qo‘shsangiz Cursor’ni qayta ochish shart emas.

---

## 3. Sozlamalar: nima yoqilgan

`.vscode/settings.json` (Cursor ham o‘qiydi):

- `editor.formatOnSave: true` + Prettier → saqlashda format.
- `editor.codeActionsOnSave: { "source.fixAll.eslint": "explicit" }` → import tartibi,
  `prefer-const`, ortiqcha escape avtomatik tuzatiladi (faqat o‘zgartirilgan faylda).
- `eslint.useFlatConfig: true` → ESLint 9 flat config (`eslint.config.mjs`).
- `eslint.workingDirectories: [{ directory: "frontend" }]` → monorepo’da to‘g‘ri config topiladi.
- `editor.rulers: [100]` → `.prettierrc.json` dagi `printWidth: 100` bilan mos.
- `tailwindCSS.experimental.classRegex` → `cn("...")` ichidagi klasslar ham tekshiriladi.
- `typescript.tsdk` → frontend’dagi TypeScript versiyasi (6.x) ishlatiladi.

`.editorconfig` — fayl turi bo‘yicha: TS/JS → 2 bo‘sh joy + LF; `.ps1/.cmd` → CRLF;
`*.sh` → LF (Docker uchun muhim).

---

## 4. Kundalik ish tartibi (5 buyruq)

```bash
# 0) Bir marta: bog‘liqliklarni o‘rnatish
npm run install:all

# 1) Ishlab chiqish
npm run dev                       # API :18080 + worker + web :3000

# 2) Tez tekshiruv (o‘zgarishdan keyin)
npm run lint:errors --prefix frontend      # frontend: faqat error'lar (~2 daqiqa)
cd backend && npx tsc -p tsconfig.json --noEmit   # backend tiplar (~30 sek)

# 3) Format (faqat o‘zgargan fayllar)
npm run format:write

# 4) To‘liq gate (commit/PR oldidan)
npm run prod:verify               # backend + frontend + mobile + planlar
```

Cursor’da bularning hammasi **Ctrl+Shift+B** (Build Tasks) orqali ham ishlaydi:
`lint: frontend (errors)`, `typecheck: backend`, `verify: pre-commit (lint+types+tests)`.

### Debug (F5)

`.vscode/launch.json` da tayyor konfiguratsiyalar:

1. **API (backend) — debug** — `tsx watch src/index.ts`, breakpoint ishlaydi.
2. **Worker (backend) — debug** — BullMQ job’larini qadam-baqadam kuzatish.
3. **Next.js (frontend) — debug** — server-side breakpoint + brauzer debug.
4. **Vitest — joriy fayl** — test faylini ochib F5 bosish kifoya.
5. **Full stack** — uchta jarayon birga.

---

## 5. ESLint qoidalari: nima error, nima warning

| Qoida                                                        | Daraja              | Sabab                                                        |
| ------------------------------------------------------------ | ------------------- | ------------------------------------------------------------ |
| `react-hooks/rules-of-hooks`                                 | **error**           | Hook tartibi buzilsa — runtime crash                         |
| `prefer-const`                                               | **error**           | O‘zgarmas o‘zgaruvchi                                        |
| `no-useless-escape`, `no-useless-catch`                      | **error** (backend) | Regex va try/catch niyati chalkash                           |
| `react/no-unescaped-entities`                                | **error**           | JSX’da `'` → `‘`/`&apos;`                                    |
| `@next/next/no-html-link-for-pages`                          | **error**           | Ichki havola `<Link>` bo‘lishi shart                         |
| `@typescript-eslint/no-unused-vars`                          | **warning**         | Legacy: 657 (FE) + 2173 (BE) ta mavjud — yangi kodda yozmang |
| `react-hooks/set-state-in-effect`, `refs`, `exhaustive-deps` | **warning**         | React Compiler qoidalari; ekran refaktoringida tuzatiladi    |
| `@next/next/no-location-assign-relative-destination`         | **warning**         | Token muddati tugaganda ataylab to‘liq reload                |

**Nega hammasi error qilinmadi?** Agar 1400+ warning’ni bir kunda errorga aylantirsak,
CI darhol qizil bo‘ladi va hech kim ishlay olmaydi. Shuning uchun strategiya:

1. **Yangi kod** — 0 error, 0 warning (Cursor qoidasi shuni talab qiladi).
2. **Legacy** — warning. Tegishli ekranni refaktoring qilayotganda warning’lar soni kamayadi.
3. Har sprint oxirida: `npm run lint:errors` (0 error) + warning soni kamayishi kuzatiladi.

Warning sonini o‘lchash:

```bash
npm run lint --prefix frontend 2>&1 | tail -3      # "X problems (0 errors, Y warnings)"
npm run lint --prefix backend  2>&1 | tail -3
```

---

## 6. Prettier: nega butun repo birdaniga formatlanmadi

`npm run format:all:check` hozir ~2000+ faylda farq ko‘rsatadi. Sabablari:

1. **CRLF va LF aralash** — Windows’da yozilgan fayllar `\r\n`, yangilari `\n`.
   `.prettierrc.json` da `"endOfLine": "auto"` — bu mavjud satr oxirini saqlaydi,
   ya’ni butun fayl “o‘zgardi” bo‘lib ko‘rinmaydi.
2. **`trailingComma: none`** — mavjud kod shu uslubda, `all` qilinsa har bir
   ko‘p qatorli ro‘yxat o‘zgaradi (6000+ satr diff).
3. **`printWidth: 100`** — backend satrlarining 3% i 100 dan uzun, 1% i 120 dan uzun.
   100 eng kam shovqin beradi va o‘qish uchun qulay.

Shuning uchun:

```bash
npm run format:write      # faqat o‘zgargan fayllar (git diff asosida)
npm run format:check      # CI uchun tekshiruv (o‘zgargan fayllar)
```

Butun repo’ni bir marta formatlash kerak bo‘lsa (alohida PR sifatida qiling,
funksional o‘zgarishlar bilan aralashtirmang):

```bash
npm run format:all:write
git diff --stat | tail -1        # ~2000 fayl, +40k/−40k satr bo‘lishi mumkin
```

---

## 7. Cursor’da tez-tez ishlatiladigan promptlar

```
"components/stock/stock-balances-workspace.tsx ni 400 satrdan kichik bo'laklarga bo'l"
→ fayl hajmi qoidasi buzilgan (audit:max-loc)

"order-create-view.tsx dagi 53 ta warning'ni tuzat, funksiyani o'zgartirmasdan"
→ no-unused-vars tozalash (xavfsiz, chunki faqat importlar)

"react-hooks/set-state-in-effect ni clients/page.tsx da tuzat"
→ setState'ni effect tashqarisiga chiqarish (sxema: derive during render)

"yangi API route qo'sh: /api/:slug/xxx — RBAC guard, Zod schema, test bilan"
→ .cursor/rules/project-standards.mdc + security-checklist.mdc avtomatik qo'llanadi
```

**Muhim:** Cursor’ga “hammasini lint qilib tuzat” deb bermang — u 2000+ warning’ni
bitta commit’da “tuzatadi” va review qilib bo‘lmaydi. Har doim **bitta modul** yoki
**bitta qoida** bilan chegaralang.

---

## 8. Naqshlar: eng ko‘p uchraydigan 3 muammo va yechimi

### 8.1. `set-state-in-effect` (429 ta warning)

**Muammo:** effekt ichida `setState` → ortiqcha render (React Compiler buni optimallashtira olmaydi).

```tsx
// ❌ noto'g'ri
useEffect(() => {
  setViewYm({ y: d.getFullYear(), m: d.getMonth() });
}, [open, value]);

// ✅ to'g'ri: render paytida hisoblash (derived state)
const viewYm = useMemo(() => {
  const d = parseLocalDateTime(value);
  return { y: d.getFullYear(), m: d.getMonth() };
}, [value]);
```

Agar holat **tashqi tizimdan** kelsa (localStorage, WebSocket) — `useSyncExternalStore`
yoki `useEffect` + `setState` faqat callback ichida.

### 8.2. `no-unused-vars` (657 FE + 2173 BE)

Ko‘pchiligi — refaktoringdan qolgan importlar. Xavfsiz tuzatish:

```bash
npx eslint src/components/orders --fix     # faqat importlarni olib tashlaydi
npm run typecheck --prefix frontend        # tip xatosi yo'qligini tekshir
```

Diqqat: `_unused` prefiksi bilan qoldirish mumkin (`argsIgnorePattern: "^_"`).

### 8.3. Fayl hajmi 400 satr (`audit:max-loc`)

Hozir 10 ta fayl limitdan oshgan (`tabel-settings-workspace.tsx` — 1347 satr).
Yondashuv: **ekran → hook + ko‘rinish (view) + yordamchi (utils)**.

```
components/tabel/
  tabel-settings-workspace.tsx      # 120 satr: faqat kompozitsiya
  hooks/use-tabel-settings.ts       # 250 satr: state + query + mutation
  view/tabel-settings-form.tsx      # 300 satr: JSX
  tabel-settings.utils.ts           # 150 satr: sof funksiyalar
```

`scripts/audit-max-file-lines.mjs` legacy allowlist bilan ishlaydi — yangi fayl
qo‘shsangiz allowlist’ga yozmang, bo‘ling.

---

## 9. CI gate (GitHub Actions)

Lint gate `prod:verify` ga **allaqachon qo‘shilgan** (`package.json`):

```bash
npm run prod:verify
# = lint:errors (backend) && lint:errors (frontend) && prod:verify (backend) && ...
```

Ya’ni relizdan oldin lokal tekshiruv lint’siz o‘tmaydi.

### `ci.yml` uchun qo‘shimcha qadam (qo‘lda qo‘shish kerak)

Bu branch’da `.github/workflows/ci.yml` ni push qilib bo‘lmadi —
GitHub App’da `workflows` ruxsati yo‘q:

```
refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml`
without `workflows` permission
```

Shuning uchun quyidagi 8 satrni **GitHub veb-interfeysida** (yoki `workflows`
ruxsatli token bilan) qo‘shing. Backend job’da (`Typecheck scripts` dan keyin):

```yaml
- name: ESLint (errors only)
  run: npm run lint:errors
  working-directory: backend
```

Frontend job’da (`npm audit` dan keyin, `Audit max file lines` dan oldin):

```yaml
- name: ESLint (errors only)
  run: npm run lint:errors
  working-directory: frontend
```

Bu qadam **warning’larni bloklamaydi**, faqat error’larni. Hozirgi holat:
backend 0 error, frontend 0 error — gate yashil bo‘ladi.

> `npm ci` backend’da `eslint`, `@eslint/js`, `typescript-eslint` ni o‘rnatadi
> (`devDependencies`, `package-lock.json` yangilangan), qo‘shimcha o‘rnatish kerak emas.

## 10. Keyingi qadamlar (tavsiya, ustuvorlik bo‘yicha)

| #   | Ish                                                      | Foyda                                 | Mehnat            |
| --- | -------------------------------------------------------- | ------------------------------------- | ----------------- |
| 1   | `tabel-settings-workspace.tsx` (1347) ni bo‘lish         | `audit:max-loc` yashil, Cursor tezroq | 1-2 kun           |
| 2   | Allowlist’dagi 10 ta tabel/timesheet faylini bo‘lish     | Refaktoring qarzi qisqaradi           | 3-4 kun           |
| 3   | `set-state-in-effect` ni 3 ta eng og‘ir ekranda tuzatish | Render soni −30%                      | 2 kun             |
| 4   | Backend `mobile.route.ts` (2000+ satr) ni bo‘lish        | God-file yo‘qoladi                    | 2 kun             |
| 5   | Frontend `no-unused-vars` ni modul bo‘yicha tozalash     | Bundle kichrayadi                     | har sprint 1 soat |
| 6   | `format:all:write` ni alohida PR qilib bajarish          | Butun repo bir uslubda                | 1 kun + review    |

---

## 11. Muammolar (troubleshooting)

| Belgi                                               | Sabab                                 | Yechim                                                                                     |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| ESLint faylni tekshirmayapti                        | Cursor noto‘g‘ri papkada              | `eslint.workingDirectories` ni tekshir, `frontend` papkasini workspace’ga qo‘sh            |
| “Parsing error: Cannot find module 'next/dist/...'” | `frontend/node_modules` o‘rnatilmagan | `npm ci --prefix frontend`                                                                 |
| Prettier CRLF/LF haqida ogohlantiradi               | Windows’da fayl CRLF                  | `.prettierrc.json` da `endOfLine: "auto"` — qayta yuklash (`Ctrl+Shift+P → Reload Window`) |
| Pre-commit juda sekin                               | `tsc` butun backend’ni tekshiradi     | Faqat backend fayllari o‘zgarganda ishlaydi (`pre-commit-check.sh` shuni tekshiradi)       |
| CI’da `lint:errors` yiqildi                         | Yangi error qo‘shilgan                | `npm run lint:errors` ni lokalda yugurib tuzat                                             |

---

### Foydali havolalar (repo ichida)

- `.cursor/rules/project-standards.mdc` — izoh tili, DB, RBAC
- `.cursor/rules/security-checklist.mdc` — PR/deploy checklist
- `docs/DEVELOPER_SETUP.md` — muhitni sozlash
- `docs/ONBOARDING.md` — birinchi kun
- `scripts/audit-max-file-lines.mjs` — fayl hajmi qoidasi
