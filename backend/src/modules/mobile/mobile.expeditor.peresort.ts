/**
 * Mobil ekspeditor «Возврат с полки по заказу» — peresort (almashtirish) bo'yicha
 * aniq (explicit) qaytarish qatorlarini qurish. Toza (pure) funksiya: DB yo'q,
 * shuning uchun unit-test bilan to'liq qoplanadi.
 *
 * Qoidalar:
 *  - qo'lda «Возврат другого товара» tanlanganda SAVDO ham, BONUS ham manzil
 *    (almashtiriladigan) mahsulotga birgalikda yo'naltiriladi;
 *      · savdo manzilning pullik qoldig'i bilan cheklanadi, oshig'i manbada qoladi;
 *      · bonus manzilning bonus qoldig'i bilan cheklanadi (tanlash shartida tekshiriladi);
 *  - qo'lda manzil tanlanmasa: savdo manbada qoladi, bonus avtomatik peresort
 *    manziliga (yoki manbaga) yo'naltiriladi;
 *  - manzilga yetmagan bonus (kamchilik) «Долг бонус» summasiga qo'shiladi;
 *  - qo'lda tanlangan manzil faqat bonus qoldig'i yetarli bo'lsa qabul qilinadi,
 *    aks holda avtomatik manzilga qaytiladi.
 */

export type PeresortPreviewLine = {
  product_id: number;
  paid_qty: number;
  bonus_qty: number;
  bonus_warehouse_product_id: number;
  bonus_debt_amount: number;
  peresort_debt_amount: number;
};

export type PeresortRequest = { return_qty: number; target?: number };

export type ManualPeresortRequest = {
  paid_qty: number;
  bonus_qty: number;
  target?: number;
};

export type PeresortReturnLine = {
  product_id: number;
  paid_qty: number;
  bonus_qty: number;
};

/**
 * «По продуктам» (qo'lda) — foydalanuvchi kiritgan savdo/bonus AYNAN hurmat qilinadi
 * (avto-hisob yo'q, «долг» yo'q). «Возврат другого товара» tanlansa, savdo ham,
 * bonus ham manzil mahsulotga yo'naltiriladi (savdo — pullik qoldiq bilan cheklab).
 */
export function buildManualPeresortLines(args: {
  manualReq: Map<number, ManualPeresortRequest>;
  orderBonusPool: Map<number, number>;
  orderPaidPool: Map<number, number>;
}): { lines: PeresortReturnLine[] } {
  const { manualReq, orderBonusPool, orderPaidPool } = args;
  const merged = new Map<number, { paid: number; bonus: number }>();
  const addLine = (pid: number, paid: number, bonus: number) => {
    const c = merged.get(pid) ?? { paid: 0, bonus: 0 };
    c.paid += paid;
    c.bonus += bonus;
    merged.set(pid, c);
  };

  for (const [pid, v] of manualReq) {
    const manual = v.target;
    const manualOk =
      manual != null &&
      manual !== pid &&
      (orderBonusPool.get(manual) ?? 0) + 1e-9 >= v.bonus_qty;

    if (manualOk) {
      const target = manual as number;
      if (v.paid_qty > 0) {
        const paidCap = orderPaidPool.get(target) ?? 0;
        const paidToTarget = Math.min(v.paid_qty, paidCap);
        if (paidToTarget > 0) addLine(target, paidToTarget, 0);
        const stay = v.paid_qty - paidToTarget;
        if (stay > 0) addLine(pid, stay, 0);
      }
      if (v.bonus_qty > 0) addLine(target, 0, v.bonus_qty);
    } else {
      if (v.paid_qty > 0) addLine(pid, v.paid_qty, 0);
      if (v.bonus_qty > 0) addLine(pid, 0, v.bonus_qty);
    }
  }

  const lines = Array.from(merged.entries())
    .filter(([, x]) => x.paid + x.bonus > 0)
    .map(([product_id, x]) => ({ product_id, paid_qty: x.paid, bonus_qty: x.bonus }));
  return { lines };
}

export function buildPeresortReturnLines(args: {
  previewLines: PeresortPreviewLine[];
  reqByProduct: Map<number, PeresortRequest>;
  orderBonusPool: Map<number, number>;
  /** Manzil mahsulotning pullik (savdo) qoldig'i — savdoni yo'naltirishni cheklash uchun. */
  orderPaidPool?: Map<number, number>;
}): { lines: PeresortReturnLine[]; bonusDebt: number } {
  const { previewLines, reqByProduct, orderBonusPool } = args;
  const orderPaidPool = args.orderPaidPool ?? new Map<number, number>();
  const merged = new Map<number, { paid: number; bonus: number }>();
  const addLine = (pid: number, paid: number, bonus: number) => {
    const c = merged.get(pid) ?? { paid: 0, bonus: 0 };
    c.paid += paid;
    c.bonus += bonus;
    merged.set(pid, c);
  };

  let totalDebt = 0;
  for (const pl of previewLines) {
    const req = reqByProduct.get(pl.product_id);
    const baseDebt = Math.max(0, pl.bonus_debt_amount - pl.peresort_debt_amount);

    const manual = req?.target;
    // Qo'lda «Возврат другого товара»: manzil bonus qoldig'i yetsa — SAVDO va
    // BONUS birgalikda manzilga yo'naltiriladi.
    const manualOk =
      manual != null &&
      manual !== pl.product_id &&
      (orderBonusPool.get(manual) ?? 0) + 1e-9 >= pl.bonus_qty;

    if (manualOk) {
      const target = manual as number;
      // Savdo: manzilning pullik qoldig'i bilan cheklab, oshig'i manbada qoladi.
      if (pl.paid_qty > 0) {
        const paidCap = orderPaidPool.get(target) ?? 0;
        const paidToTarget = Math.min(pl.paid_qty, paidCap);
        if (paidToTarget > 0) addLine(target, paidToTarget, 0);
        const paidStay = pl.paid_qty - paidToTarget;
        if (paidStay > 0) addLine(pl.product_id, paidStay, 0);
      }
      // Bonus: to'liq manzilga (qoldiq yetarli — yuqorida tekshirildi).
      if (pl.bonus_qty > 0) addLine(target, 0, pl.bonus_qty);
      totalDebt += baseDebt;
      continue;
    }

    // Qo'lda manzil yo'q/yaroqsiz: savdo manbada, bonus avtomatik peresort/manba.
    if (pl.paid_qty > 0) addLine(pl.product_id, pl.paid_qty, 0);

    let lineDebt = baseDebt;
    if (pl.bonus_qty > 0) {
      let target = pl.product_id;
      let bonusToTarget = pl.bonus_qty;
      let peresortDebt = 0;

      const autoTarget = pl.bonus_warehouse_product_id || pl.product_id;
      if (autoTarget !== pl.product_id) {
        const cap = orderBonusPool.get(autoTarget) ?? 0;
        target = autoTarget;
        bonusToTarget = Math.min(pl.bonus_qty, cap);
        peresortDebt = pl.peresort_debt_amount;
      }

      if (bonusToTarget > 0) addLine(target, 0, bonusToTarget);
      lineDebt = baseDebt + peresortDebt;
    }
    totalDebt += lineDebt;
  }

  const lines = Array.from(merged.entries())
    .filter(([, v]) => v.paid + v.bonus > 0)
    .map(([product_id, v]) => ({
      product_id,
      paid_qty: v.paid,
      bonus_qty: v.bonus
    }));

  return { lines, bonusDebt: totalDebt > 0 ? Number(totalDebt.toFixed(2)) : 0 };
}
