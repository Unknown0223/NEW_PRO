# Dashboard EXPLAIN natijalari (staging)

`backend/scripts/dashboard-explain.sql` ni staging DB da ishga tushiring va natijalarni shu faylga qo'shing.

| So'rov | Index ishlatildi? | Execution ms | Eslatma |
|--------|-------------------|--------------|---------|
| SM SKU | | | |
| Finance debt | | | |
| Orders scope | | | |

CTE birlashtirish faqat execution > 800ms bo'lsa kerak — hozir mavjud indekslar: `orders_tenant_id_order_type_created_at_idx`, `orders_tenant_order_type_agent_created_at_idx`.
