/**
 * Mijoz bo‘yicha akt-sverka: bitta ma’lumot manbai — PDF, JSON API va Excel.
 */
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";

import type { ClientReconciliationLoaded } from "./client-reconciliation.types";

export async function loadClientReconciliation(
  tenantId: number,
  clientId: number,
  dateFromStart: Date,
  dateToEnd: Date
): Promise<ClientReconciliationLoaded> {
  if (dateFromStart.getTime() > dateToEnd.getTime()) {
    throw new Error("BAD_DATE_RANGE");
  }
  const maxMs = 400 * 24 * 60 * 60 * 1000;
  if (dateToEnd.getTime() - dateFromStart.getTime() > maxMs) {
    throw new Error("DATE_RANGE_TOO_LONG");
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      name: true,
      legal_name: true,
      client_code: true,
      credit_limit: true
    }
  });
  if (!client) {
    throw new Error("NOT_FOUND");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true }
  });

  const bal = await prisma.clientBalance.findUnique({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    select: { id: true, balance: true }
  });

  const balId = bal?.id ?? null;
  let openingSum = new Prisma.Decimal(0);
  let movementsInPeriod: Array<{ created_at: Date; delta: Prisma.Decimal; note: string | null }> = [];

  if (balId != null) {
    const [openAgg, movRows] = await Promise.all([
      prisma.clientBalanceMovement.aggregate({
        where: { client_balance_id: balId, created_at: { lt: dateFromStart } },
        _sum: { delta: true }
      }),
      prisma.clientBalanceMovement.findMany({
        where: {
          client_balance_id: balId,
          created_at: { gte: dateFromStart, lte: dateToEnd }
        },
        orderBy: { created_at: "asc" },
        select: { created_at: true, delta: true, note: true }
      })
    ]);
    openingSum = openAgg._sum.delta ?? new Prisma.Decimal(0);
    movementsInPeriod = movRows;
  }

  let periodMovementsSum = new Prisma.Decimal(0);
  for (const m of movementsInPeriod) {
    periodMovementsSum = periodMovementsSum.add(m.delta);
  }
  const closingAtPeriodEnd = openingSum.add(periodMovementsSum);

  const [ordersInPeriod, paymentsInPeriod, outstandingAgg] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        created_at: { gte: dateFromStart, lte: dateToEnd }
      },
      orderBy: { created_at: "asc" },
      select: {
        number: true,
        created_at: true,
        total_sum: true,
        status: true,
        order_type: true
      }
    }),
    prisma.payment.findMany({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        deleted_at: null,
        created_at: { gte: dateFromStart, lte: dateToEnd }
      },
      orderBy: { created_at: "asc" },
      include: { order: { select: { number: true } } }
    }),
    prisma.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
      },
      _sum: { total_sum: true }
    })
  ]);

  let sumOrders = new Prisma.Decimal(0);
  for (const o of ordersInPeriod) {
    sumOrders = sumOrders.add(o.total_sum);
  }
  let sumPayments = new Prisma.Decimal(0);
  for (const p of paymentsInPeriod) {
    sumPayments = sumPayments.add(p.amount);
  }

  const accountBalance = bal?.balance ?? new Prisma.Decimal(0);
  const outstandingOrdersTotal = outstandingAgg._sum.total_sum ?? new Prisma.Decimal(0);

  return {
    dateFromStart,
    dateToEnd,
    tenantName: tenant?.name?.trim() || `Tenant #${tenantId}`,
    client: {
      id: client.id,
      name: client.name,
      legal_name: client.legal_name?.trim() || null,
      client_code: client.client_code?.trim() || null,
      credit_limit: client.credit_limit
    },
    accountBalance,
    outstandingOrdersTotal,
    openingSum,
    periodMovementsSum,
    closingAtPeriodEnd,
    sumOrders,
    sumPayments,
    ordersInPeriod,
    paymentsInPeriod,
    movementsInPeriod
  };
}

