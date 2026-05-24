# Frontend (Next.js 14)

- **Stack:** Next.js App Router, Tailwind, Shadcn UI (base), TanStack Query, Zustand, Axios.
- **Auth:** `middleware.ts` — `/dashboard` va `/products` uchun `sd_auth` cookie; login muvaffaqiyatidan keyin cookie qo‘yiladi.
- **Layout:** `(dashboard)` guruhida sidebar (`AppShell`) — Desktop va mobil navigatsiya.
- **Mahsulotlar:** `/products` — `GET /api/:slug/products` dan jadval (qidiruv, sahifalash).
- **Ishga tushirish:** `npm install` → `npm run dev` → [http://localhost:3000](http://localhost:3000)
- **API:** `.env.local` da `NEXT_PUBLIC_API_URL` (namuna: [.env.example](.env.example)).

Keyingi bosqich: mahsulotlar, jadvallar va refresh token interceptor.
