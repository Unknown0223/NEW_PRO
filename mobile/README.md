# SalesDoc Mobil Ilova

Flutter ilova — **agent**, **ekspeditor**, **supervayzer** rollari uchun.

**To'liq arxitektura:** [MOBILE_APP_TOLOQ_REJA_UZ.md](./MOBILE_APP_TOLOQ_REJA_UZ.md)

## Dev muhit

| Parametr | Qiymat |
|----------|--------|
| Tenant (test) | `test1` |
| Agent login (seed) | `agent` / `111111` |
| Agent login (import) | `demo_agent_sample` / `Parol123!` |
| Backend | `http://127.0.0.1:18080` |
| Veb panel | `http://127.0.0.1:3000` |

### Android emulator

```bash
adb reverse tcp:18080 tcp:18080
```

Kirill yo‘l muammosi uchun build:

```powershell
robocopy "d:\SALEC — копия\mobile\lib" C:\salesdoc_mobile\lib /MIR
cd C:\salesdoc_mobile
flutter run
```

## Ishga tushirish

```bash
cd mobile
flutter pub get
copy .env.example .env   # API_BASE_URL=http://127.0.0.1:18080

# Monorepo root
cd ..
.\start-dev-quick.cmd

cd mobile
flutter test
flutter run
```

## Verify (CI gate)

```powershell
# Monorepo root
npm run bitta-ilova:verify

# yoki alohida
cd backend && npm run bitta-ilova:verify
cd mobile && powershell -File tool/verify.ps1
```

## Backend tayyorgarlik

```bash
cd backend
npm run rbac:ensure -- test1
npm run agents:config -- test1
powershell -File scripts/test-mobile-agent-flow.ps1
```

## Mobil API (asosiy)

| Endpoint | Rol |
|----------|-----|
| `POST /api/auth/login` | Barcha |
| `GET /api/:slug/mobile/agent-config` | Mobil rollar |
| `POST /api/:slug/mobile/sync/full` | Mobil rollar |
| `POST /api/:slug/mobile/sync/delta` | Mobil rollar |
| `GET /api/:slug/mobile/agent-dashboard` | Agent KPI (qisqa) |
| `GET /api/:slug/mobile/agent-kpi` | Agent KPI plan/fact (to‘liq) |
| `GET /api/:slug/mobile/agent-timesheet` | Agent табель |
| `PATCH /api/:slug/mobile/clients/:id` | Agent mijoz tahriri |
| `GET /api/:slug/mobile/clients/debtors` | Agent qarzdorlar |
| `GET/POST mobile/orders/*` | Agent buyurtma |
| `GET mobile/expeditor/deliveries` | Ekspeditor |
| `PATCH mobile/expeditor/orders/:id/status` | Ekspeditor |
| `GET mobile/supervisor/summary\|visits\|products\|agent-locations` | Supervayzer |

## E2E checklist (emulator, agent)

1. Login → bootstrap → bosh sahifa KPI
2. Sinxron → muvaffaqiyat ekrani
3. Mijoz → tahrir → server
4. Buyurtma to‘liq zanjir (onlayn)
5. Internet o‘chir → oflayn navbat → sync
6. Ombor qoldig‘i
7. Vizit + GPS
8. Hisobot / qarzdorlar
9. Chiqish / qayta kirish

## Holat (2026-05)

| Faza | Holat |
|------|-------|
| Agent (asosiy oqim) | API + UI ulangan |
| Oflayn navbat | `enqueue` + `sync-flush` + SQLite v4 |
| Ekspeditor | Yetkazishlar serverdan, holat PATCH |
| Supervayzer | Dashboard API, vizitlar, agent GPS |
| Push (FCM prod) | Token ro‘yxat — Firebase kerak |
