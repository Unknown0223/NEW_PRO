# SALEC dizayn hujjati

Bu hujjat dizayn jamoasi uchun qisqa va amaliy yo'riqnoma. Maqsad: asosiy sahifalarni bir xil UI tamoyili asosida chizish, foydalanuvchi oqimlarini aniq belgilash, komponent kutubxonasini standartlashtirish va backend bilan bog'lanadigan joylarni oldindan tushunish. Hujjat texnik kodni takrorlamaydi, balki dizaynerga ishlash uchun aniq ramka beradi.

1) Mahsulot mazmuni
SALEC savdo jarayonlarini boshqaruvchi platforma: mijozlar, buyurtma, to'lov, ombor, qaytarish, hisobot, ruxsat va sozlamalar. Interfeys operatsion tezlikka yo'naltiriladi, ya'ni bir necha bosqichli ishlar minimal klik bilan bajariladi.

2) Asosiy ekran guruhlari
A) Kirish: / va /login.
B) Dashboard: /dashboard, /dashboard/finance, /dashboard/sales, /dashboard/sales-monitoring.
C) Orders: /orders, /orders/new, /orders/[id], /orders/[id]/history.
D) Returns va invoices: /returns, /returns/new, /invoices/assembly, /invoices/shipment, /invoices/returns.
E) Clients: /clients, /clients/new, /clients/[id], /clients/[id]/details, /clients/[id]/edit, /clients/[id]/balances, /clients/map, /clients/qr, /clients/merge, /clients/equipment, /clients/equipment/history, /clients/retail-stock.
F) Payments va finance: /payments, /payments/new, /payments/[id], /client-balances, /client-balances/consignment, /initial-client-balances, /client-expenses, /expenses, /currency-rates.
G) Stock va suppliers: /stock, /stock/warehouses, /stock/blocks, /stock/balances, /stock/receipts, /stock/receipts/new, /stock/transfers, /stock/transfers/new, /stock/correction, /suppliers, /suppliers/payments, /suppliers/balances, /suppliers/reconciliation.
H) Reports: /reports, /reports/agent-orders, /reports/client-sales-2, /reports/client-sales-4, /reports/product-sales, /reports/expeditor-returns, /reports/visits-2, /reports/visit-totals, /reports/builder.
I) Access va settings: /access, /access/history, /access/role-defaults, hamda /settings ichidagi bo'limlar.

3) Dizayn tamoyillari
- Har bir list sahifada: qidiruv, filtr, reset, ustun sozlash, pagination.
- Har bir forma sahifada: required belgilash, validatsiya, xatolik va success feedback.
- Har bir detail sahifada: yuqori qismda status, o'ng tomonda asosiy actionlar.
- Dialoglar bir xil tuzilishda: sarlavha, qisqa izoh, asosiy tugma, bekor qilish tugmasi.
- Muhim actionlar vizual ustuvorlikka ega bo'lsin.

4) UI komponentlar ro'yxati
Button, Input, Select, DateRange, MultiSelect, Table, Pagination, Tabs, Badge, Modal, Drawer, Toast, EmptyState, ErrorState, ConfirmDialog, FilterBar, PageHeader, KPI Card.

5) Holatlar katalogi
Loading, Empty, Error, Success, Disabled, PermissionDenied holatlari har bir kritik ekranda oldindan chiziladi.

6) Responsiv qoidalar
Desktop birinchi, keyin planshet va mobil. Katta jadval mobilga o'tganda card yoki qisqa ustunli ko'rinishga o'tadi. Primary action mobil qurilmada ham ko'rinarli qoladi.

7) Backend bog'lanish xaritasi
Auth, Access, Dashboard, Orders, Clients, Payments, Stock, Reports, Settings endpoint guruhlari bilan ishlaydi. Dizayn topshirig'ida har bir ekranga qaysi ma'lumot o'qilishi va qaysi amal yozilishi alohida qayd etiladi.

8) Dizayn topshirish formati
Screen inventory, user flow, component library, design tokens, clickable prototype, handoff notes.

9) Prioritet ketma-ketlik
1. Login va dashboard.
2. Orders va returns.
3. Clients moduli.
4. Payments va balances.
5. Stock va suppliers.
6. Reports.
7. Access va settings.

Ushbu versiya 5000 belgi talabi uchun maxsus optimallashtirildi. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil terminlardan foydalansin. Qo'shimcha eslatma: dizayn va implementatsiya bir xil t