# Mobil E2E checklist

Redesign branch: `feature/mobile-ui-redesign`  
Legacy kundalik: `mobile_legacy/`  
**Merge `main` ga:** faqat barcha rol bandlari yashil + redesign smoke.

## Redesign UI smoke (shablon parity)

- [x] Login BrandWave / stagger
- [x] PIN setup/unlock (slot + press)
- [x] GlobalChrome: hamburger chap, sync o‘ng (agent/exp/sv home)
- [x] Sync sheet: Rol / Oddiy / Hammasi + oflayn qator
- [x] SaBrandSync + RoadScene (agent overlay / bootstrap / ekspeditor)
- [x] Home stagger + drawer guruhlari
- [x] OrderFlow rail (create order)
- [x] RoleWelcome (bootstrap success)
- [ ] Emulator smoke: login → welcome → home → sync sheet → BrandSync (qo‘lda)

## Agent (`test1` / `agent` / `111111` yoki `demo_agent_sample` / `Parol123!`)

- [x] Login, bootstrap, bosh sahifa KPI serverdan
- [x] Qo‘lda sync → success
- [x] Mijoz qidiruv, kartochka, server PATCH
- [x] Yangi mijoz POST (`POST mobile/clients`)
- [x] Buyurtma: mijoz → setup → mahsulot → bonus → vebda ko‘rinadi
- [x] Oflayn buyurtma navbat → onlayn flush
- [x] Ombor qoldig‘i server bilan mos
- [x] Vizit POST + FAB
- [x] Vizit tugatish / rad etish (sabab bilan, serverga `refusal_reason_ref`)
- [x] Marshrut (`/route`, `agent-route-days/one`)
- [x] Kunlik hisobot (server KPI)
- [x] Qarzdorlar ro‘yxati
- [x] Drawer, FAB, orqaga navigatsiya
- [x] Buyurtmalar ro‘yxati + delta sync
- [x] Mahsulot qidiruv (buyurtma)
- [x] Mijoz fotolari (server `photo-reports`)
- [x] Rad sabablari tenant `refusal_reason_entries`
- [x] Van selling to‘lov (config `payment_required`)
- [x] Vizit/buyurtma radius (`require_within_outlet_radius_m`)

## Ekspeditor

- [ ] Login, yetkazishlar ro‘yxati serverdan
- [ ] Buyurtma detail → «Yetkazildi» status
- [x] Home GlobalChrome + SaBrandSync (UI wiring)

## Supervayzer

- [ ] Login, summary KPI
- [ ] Vizitlar ro‘yxati
- [ ] Agentlar GPS ro‘yxati
- [ ] Dashboard mahsulotlar
- [x] Home GlobalChrome (UI wiring)

## Avtomatik

```powershell
cd backend
powershell -File scripts/test-mobile-agent-flow.ps1
```

```bash
cd mobile && flutter test
```
