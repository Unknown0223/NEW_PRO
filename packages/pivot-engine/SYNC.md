# Dev Workflow — SALEC ↔ Pivot Engine sinxronizatsiya

## Kundalik ish tartibi

### Terminal 1 — Pivot Engine watch

```bash
cd packages/pivot-engine
npm install
npm run dev    # tsc --watch → dist/ yangilanadi
```

### Terminal 2 — SALEC frontend

```bash
cd frontend
npm install    # @salec/pivot-engine bog'lanadi
npm run dev
```

### Terminal 3 — Backend (dataset API uchun)

```bash
npm run dev --prefix backend
```

Yoki root dan: `npm run dev` (API + worker + frontend birga).

---

## Birinchi marta o'rnatish

```bash
# Root (workspaces)
npm install

# Pivot engine build
npm run build --prefix packages/pivot-engine

# Frontend dependency yangilash
npm install --prefix frontend
```

---

## O'zgarishlarni sinash

1. `packages/pivot-engine/src/` da kod yozing
2. `npm run dev` (watch) avtomatik `dist/` ni yangilaydi
3. Frontend dev server HMR orqali qayta yuklaydi
4. `/reports/builder/dev` sahifasini oching (`NEXT_PUBLIC_PIVOT_ENGINE=1`)

---

## Testlar

```bash
# Faqat pivot-engine
npm test --prefix packages/pivot-engine

# Watch rejim
npm run test:watch --prefix packages/pivot-engine

# Frontend (bridge va flag testlari keyinroq)
npm test --prefix frontend
```

---

## Muammolarni hal qilish

| Muammo | Yechim |
|--------|--------|
| `Cannot find module '@salec/pivot-engine'` | `npm run build --prefix packages/pivot-engine` |
| TypeScript xatolari frontend da | `dist/*.d.ts` mavjudligini tekshiring |
| Next.js transpile xatosi | `next.config.mjs` → `transpilePackages` |
| Eski build keshi | `npm run clean --prefix frontend` |
| Workspace bog'lanmagan | Root dan `npm install` yoki `file:` dependency |

---

## CI

Root `package.json` ga qo'shish mumkin:

```json
{
  "scripts": {
    "test:pivot-engine": "npm run test --prefix packages/pivot-engine",
    "build:pivot-engine": "npm run build --prefix packages/pivot-engine"
  }
}
```

---

## Versiya yangilash

`packages/pivot-engine/package.json` versiyasini oshiring. Workspace yoki `file:` dependency avtomatik yangilanadi — `npm install` qayta bajarish kifoya.
