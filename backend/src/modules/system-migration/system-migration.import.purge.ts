import { prisma } from "../../config/database";

/**
 * `conflict_policy=replace` — operatsion tarix (buyurtma/to‘lov/tashrif).
 */
export async function purgeTenantTransactionalForReplace(tenantId: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.paymentAllocation.deleteMany({ where: { tenant_id: tenantId } });
      await tx.payment.deleteMany({ where: { tenant_id: tenantId } });
      await tx.salesReturnLine.deleteMany({
        where: { return: { tenant_id: tenantId } }
      });
      await tx.salesReturn.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientPhotoReport.deleteMany({ where: { tenant_id: tenantId } });
      await tx.orderItem.deleteMany({ where: { order: { tenant_id: tenantId } } });
      await tx.orderStatusLog.deleteMany({ where: { order: { tenant_id: tenantId } } });
      await tx.orderChangeLog.deleteMany({ where: { order: { tenant_id: tenantId } } });
      await tx.order.deleteMany({ where: { tenant_id: tenantId } });
      await tx.goodsReceiptLine.deleteMany({
        where: { receipt: { tenant_id: tenantId } }
      });
      await tx.goodsReceipt.deleteMany({ where: { tenant_id: tenantId } });
      await tx.agentVisit.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientRefusal.deleteMany({ where: { tenant_id: tenantId } });
      await tx.expense.deleteMany({ where: { tenant_id: tenantId } });
    },
    { timeout: 120_000 }
  );
}

/**
 * Append-only jurnallar — replace da eski nusxalar qolmasin (aks holda 2× bo‘ladi).
 */
export async function purgeTenantAuditHistoryForReplace(tenantId: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.tenantAuditEvent.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientAuditLog.deleteMany({ where: { tenant_id: tenantId } });
      await tx.userActivityEvent.deleteMany({ where: { tenant_id: tenantId } });
      await tx.slotAuditEntry.deleteMany({ where: { tenant_id: tenantId } });
    },
    { timeout: 180_000 }
  );
}

/** Bonus / KPI — har import create qiladi; replace da oldindan tozalash. */
export async function purgeTenantBonusKpiForReplace(tenantId: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.salesKpiPlanTarget.deleteMany({ where: { tenant_id: tenantId } });
      await tx.salesKpiPlan.deleteMany({ where: { tenant_id: tenantId } });
      await tx.kpiGroupAgent.deleteMany({ where: { kpi_group: { tenant_id: tenantId } } });
      await tx.kpiGroupProduct.deleteMany({ where: { kpi_group: { tenant_id: tenantId } } });
      await tx.kpiGroup.deleteMany({ where: { tenant_id: tenantId } });
      await tx.bonusRuleCondition.deleteMany({
        where: { bonus_rule: { tenant_id: tenantId } }
      });
      await tx.bonusRuleClause.deleteMany({
        where: { bonus_rule: { tenant_id: tenantId } }
      });
      await tx.bonusStrategyMember.deleteMany({
        where: { strategy: { tenant_id: tenantId } }
      });
      await tx.bonusStrategy.deleteMany({ where: { tenant_id: tenantId } });
      await tx.bonusRule.deleteMany({ where: { tenant_id: tenantId } });
    },
    { timeout: 120_000 }
  );
}

/**
 * To‘liq restore: mijoz + mahsulot + tarix + bonus — arxivdan qayta yaratish uchun.
 * User/ombor/rol merge bo‘lib qoladi (login/code bo‘yicha).
 */
export async function purgeTenantClientsForReplace(tenantId: number): Promise<void> {
  await purgeTenantTransactionalForReplace(tenantId);
  await purgeTenantAuditHistoryForReplace(tenantId);
  await purgeTenantBonusKpiForReplace(tenantId);

  await prisma.$transaction(
    async (tx) => {
      await tx.warehouseCorrectionLine.deleteMany({
        where: { document: { tenant_id: tenantId } }
      });
      await tx.warehouseCorrection.deleteMany({ where: { tenant_id: tenantId } });
      await tx.productPrice.deleteMany({ where: { tenant_id: tenantId } });
      await tx.stock.deleteMany({ where: { tenant_id: tenantId } });
      await tx.cashDeskShift.deleteMany({ where: { tenant_id: tenantId } });

      await tx.clientAgentAssignment.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientBalanceMovement.deleteMany({
        where: { client_balance: { tenant_id: tenantId } }
      });
      await tx.clientBalance.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientEquipment.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientTagLink.deleteMany({
        where: { client: { tenant_id: tenantId } }
      });
      await tx.clientMergeLog.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientSavedDuplicateGroup.deleteMany({ where: { tenant_id: tenantId } });
      await tx.retailOutletStock.deleteMany({ where: { tenant_id: tenantId } });
      await tx.clientOpeningBalanceEntry.deleteMany({ where: { tenant_id: tenantId } });

      await tx.client.updateMany({
        where: { tenant_id: tenantId },
        data: { merged_into_client_id: null, agent_id: null }
      });
      await tx.client.deleteMany({ where: { tenant_id: tenantId } });

      // Seed mahsulotlari arxivdan tashqari qolmasin
      await tx.product.deleteMany({ where: { tenant_id: tenantId } });
    },
    { timeout: 300_000 }
  );
}
