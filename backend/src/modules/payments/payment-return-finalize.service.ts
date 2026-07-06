/**
 * Qaytarilgan / rad etilgan to'lovlarni taymer tugagach yakunlash.
 *
 * Biznes qoidasi: «Отклонено» (rejected) — vaqtinchalik holat. Kassir to'lovni
 * rad etganda yoki ekspeditorga qaytarganda, ekspeditorga to'g'rilash uchun
 * taymerli oyna ochiladi (paymentEditGrant.expires_at). Agar ekspeditor shu
 * vaqt ichida to'g'rilamasa, to'lov avtomatik ravishda yana
 * `pending_confirmation` ga qaytadi — ya'ni oddiy, tasdiqlanmagan ekspeditor
 * to'lovi sifatida ro'yxatda paydo bo'ladi (balansga qo'shilmaydi; keyin kassir
 * uni odatdagidek tasdiqlaydi). Shunday qilib «rad/qulflangan» holat hech qachon
 * doimiy boshi berk ko'cha bo'lib qolmaydi.
 */
import { prisma } from "../../config/database";
import { invalidateDashboard } from "../../lib/redis-cache";

/**
 * Taymeri tugagan (active grant + expires_at < now), hali `rejected` va
 * o'chirilmagan to'lovlarni topib, qayta `pending_confirmation` ga o'tkazadi.
 * @returns yakunlangan to'lovlar soni.
 */
export async function finalizeExpiredRejectedPayments(now: Date = new Date()): Promise<number> {
  const grants = await prisma.paymentEditGrant.findMany({
    where: {
      status: "active",
      expires_at: { lt: now },
      payment: { workflow_status: "rejected", deleted_at: null, entry_kind: "payment" }
    },
    select: { id: true, tenant_id: true, payment_id: true }
  });
  if (grants.length === 0) return 0;

  const tenantIds = new Set<number>();
  let finalized = 0;

  for (const g of grants) {
    await prisma.$transaction(async (tx) => {
      const p = await tx.payment.findFirst({
        where: {
          id: g.payment_id,
          tenant_id: g.tenant_id,
          workflow_status: "rejected",
          deleted_at: null
        },
        select: { id: true }
      });

      // Faol grantni har holda yopamiz (taymer tugagan).
      await tx.paymentEditGrant.updateMany({
        where: { tenant_id: g.tenant_id, payment_id: g.payment_id, status: "active" },
        data: { status: "completed", completed_at: now }
      });

      // To'lov hali rad etilgan holatda bo'lsa — pending'ga qaytaramiz.
      if (p) {
        await tx.payment.update({
          where: { id: g.payment_id },
          data: {
            workflow_status: "pending_confirmation",
            confirmed_at: null,
            paid_at: null
          }
        });
        finalized += 1;
      }
    });
    tenantIds.add(g.tenant_id);
  }

  for (const t of tenantIds) void invalidateDashboard(t);
  return finalized;
}
