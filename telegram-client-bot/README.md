# Telegram klient bot (SALEC dan mustaqil)

Bu papka alohida dastur. Backend/frontend bilan birga ishga tushmaydi.

## Ishga tushirish

1. [@BotFather](https://t.me/BotFather) dan token oling.
2. `.env` yarating (`.env.example` dan).
3. `DATABASE_URL` — SALEC Postgres (login, parol, smart kod, spravochniklar shu yerdan o‘qiladi).
4. Terminal:

```
cd telegram-client-bot
npm install
npm run dev
```

## Nima qiladi

- Agent / SVR / operator / boshqa platforma hodimi: login → parol → smart kod (platforma API)
- Agent: klient qo‘shish (smart kod agent ishchi o‘rnidan)
- Boshqalar: faqat Statistika + Excel — **platforma Dostup + ish o‘rni scope** (hudud ∩ belgilangan agentlar)
- Excel — SALEC «Импорт клиент» shabloni; panelda operator/admin import qiladi

Bot `client_intake` sxemasida o‘z jadvallarini saqlaydi. SALEC `clients` jadvaliga yozmaydi — operator Excelni panel orqali import qiladi.
