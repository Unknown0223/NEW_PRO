# Tuzatish navbati (doimiy)

Oxirgi yangilanish: 2026-11-11

| # | Vazifa | Holat | Oddiy tushuntirish |
|---|---|---|---|
| 1 | Audit hujjat + reja + security qoida | ✅ | Nima buzilganini yozib qo‘ydik |
| 2 | Kalit/Excel ni git trackdan chiqarish | ✅ | Parol va xodimlar fayli endi commitga kirmaydi (tarix tozalash — qo‘lda) |
| 3 | CI audit/secret scan qattiqlash | ✅ | TruffleHog pin; audit-gate kutilmagan high/critical ni bloklaydi |
| 4 | npm audit fix (kichik) | ✅ | Major bo‘lmagan tuzatishlar qo‘llandi |
| 5 | trustProxy + rate-limit Redis | ✅ | Login limini IP+slug+login; proxy ortida to‘g‘ri IP |
| 6 | Token 15 daqiqa + sessiya | ✅ | Access 15m; sid + is_active barcha rollar uchun |
| 7 | Refresh token oilasi | ✅ | family_id; grace dan keyin reuse → butun oila revoke |
| 8 | Login himoyasi | ✅ | Lockout, dummy bcrypt, parol min 8, must_change_password |
| 9 | Davomat terminal himoya | ⏳ | Begona odam “keldi” yoza olmasin |
| 10 | Fayl yuklash xavfsizligi | ⏳ | Katta fayl serverni yiqitmasin |
| 11 | Ombor qulfi | ⏳ | Ikki agent bir mahsulotni ikki marta sotolmasin |
| 12 | Cron→worker + idempotentlik | ⏳ | Cron ikki marta ishlamasin; dublikat buyurtma yo‘q |

**Belgilar:** ⏳ kutilmoqda · 🔄 bajarilmoqda · ✅ tugadi · ⏸️ qo‘lda (siz)

**Sizdan qo‘lda (to‘xtatib bo‘lmaydi):**
1. GitHub repo → **Private**
2. Yangi Android kalit + GitHub Secrets (eski kalit oshkor)
3. `git filter-repo` — kalit/Excel ni **tarixdan** o‘chirish
4. Prod env ga `TRUST_PROXY=1` qo‘shish

**Keyingi kod:** #9 Davomat terminal himoya (device-ingest token)
