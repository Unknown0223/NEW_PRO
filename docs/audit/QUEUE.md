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
| 9 | Davomat terminal himoya | ✅ | Ingest faqat device_token; pairing TTL; user_id ishonchsiz |
| 10 | Fayl yuklash xavfsizligi | ✅ | Multipart 32MB; stream put; magic-byte (xlsx/apk/zip/jpeg) |
| 11 | Ombor qulfi | ✅ | FOR UPDATE + reserved CHECK; parallel reserve test |
| 12 | Cron→worker + idempotentlik | ⏳ | Cron ikki marta ishlamasin; dublikat buyurtma yo‘q |

**Belgilar:** ⏳ kutilmoqda · 🔄 bajarilmoqda · ✅ tugadi · ⏸️ qo‘lda (siz)

**Sizdan qo‘lda (to‘xtatib bo‘lmaydi):**
1. GitHub repo → **Private**
2. Yangi Android kalit + GitHub Secrets (eski kalit oshkor)
3. `git filter-repo` — kalit/Excel ni **tarixdan** o‘chirish
4. Prod env ga `TRUST_PROXY=1` qo‘shish
5. **Andijon terminal (id 2):** deploy oldin/keyin `issue-token` → Hikvision HttpHost URL ni `?device_token=dev_…` qilib qo‘ying (`pairing_code` endi ishlamaydi). SubscribeEvent ni o‘chirmang.

**Keyingi kod:** #12 Cron→worker + idempotentlik
