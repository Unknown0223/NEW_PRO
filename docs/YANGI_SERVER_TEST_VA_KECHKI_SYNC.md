# SALEC — yangi server tekshiruv + kechki sync

**Sana:** 2026-09-26  
**Bugun:** yangi server tayyor, siz test qilasiz.  
**Parallel:** eski Railway **ishlab turadi** — to‘liq o‘tish keyinroq.  
**Kechqurun (ixtiyoriy):** Railway’dan yana to‘liq baza → Hetzner (Railway **saqlanadi**).

---

## 1. Yangi web / API silkalari (HOZIR test qiling)

### Asosiy (tavsiya)

| Nima | Silka |
|------|--------|
| **Veb login** | https://salesarena.sale/login |
| **Veb (bosh sahifa)** | https://salesarena.sale/ |
| **API health** | https://api.salesarena.sale/health |
| **API asos** | https://api.salesarena.sale |
| **Diler slug** | `aksit` |

### IP orqali (zaxira)

| Nima | Silka |
|------|--------|
| Veb login | http://157.180.116.50:3000/login |
| Veb | http://157.180.116.50:3000 |
| API health | http://157.180.116.50:4000/health |
| API | http://157.180.116.50:4000 |
| Coolify | http://157.180.116.50:8000 |
| Mobil OTA sozlama | http://157.180.116.50:3000/settings/mobile-app |

> Login yo‘li: **`/login`** ( `/auth/login` emas ).

### Eski Railway (faqat solishtirish — kundalik ishga OCHMANG)

| Nima | Silka |
|------|--------|
| Veb | https://sales-arena.up.railway.app |
| API | https://backend-production-3cf2.up.railway.app |

---

## 2. Bugun nima qilish (siz)

1. Brauzerda oching: http://app.157.180.116.50.sslip.io/login  
2. Oddiy login (tenant + login/parol).  
3. Tekshiring: dashboard, 1 mijoz, balans, zakazlar ro‘yxati.  
4. **Yangi zakaz yozmang** kechki sync oldidan (yoki faqat Hetzner’da yozing — kechqurun Railway dump Hetzner’ni qayta yozadi).  
5. Natijani yozing: login OK / xato.

---

## 3. Kechqurun (to‘liq baza qayta)

**Maqsad:** Railway’dagi eng so‘nggi holatni Hetzner’ga to‘liq qayta tiklash.

**Qoida:** sync paytida (dump+restore ~30–60 daqiqa) **ikki serverga ham yangi zakaz/to‘lov/foto yozilmasin**.

Agent ishga tushiradi:

```powershell
cd "D:\SALEC — копия"
powershell -File .\scripts\hetzner\tonight-final-sync.ps1
```

Yoki ayting: **kechki syncni boshlа**.

Keyin yana sonlar solishtiriladi (clients/orders/photos). Railway **o‘chirilmaydi**.

---

## 4. Zakazlar qayerga tushadi?

| Vaqt | Qayer |
|------|--------|
| Hozirgi restore | Eski ma’lumot Hetzner’da |
| Bugun test | Hetzner silkalari |
| Kechki sync dan keyin | Railway’dagi oxirgi to‘liq holat → Hetzner |
| Shundan keyin doimiy | **Faqat Hetzner** silkalari |

---

## 5. Hali yo‘q (ixtiyoriy keyin)

- O‘z domen + HTTPS (Let's Encrypt)
- Cloudflare R2
- Railway ni o‘chirish (bir necha kundan keyin)
