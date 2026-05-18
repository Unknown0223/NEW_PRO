import { Prisma } from "@prisma/client";
import type { OrderAgentBonusContext } from "../order-bonus-apply";
import type { BonusStackPolicy } from "../bonus-stack-policy";
import { normalizeOrderType } from "../order-status";
import type { CreateOrderInput } from "./order.types";
import type { buildCreateOrderLineData } from "./order.create-lines";

export type CreateOrderClientRow = {
  id: number;
  category: string | null;
  sales_channel: string | null;
  product_category_ref: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  zone: string | null;
  neighborhood: string | null;
  address: string | null;
  credit_limit: Prisma.Decimal;
};

export type CreateOrderTxParams = {
  tenantId: number;
  input: CreateOrderInput;
  client: CreateOrderClientRow;
  orderType: ReturnType<typeof normalizeOrderType>;
  priceType: string;
  lineData: Awaited<ReturnType<typeof buildCreateOrderLineData>>["lineData"];
  totalSum: Prisma.Decimal;
  qtyByProduct: Map<number, number>;
  productById: Map<number, { id: number; category_id: number | null }>;
  orderedProductIds: Set<number>;
  exchangeMetaJson: Prisma.InputJsonValue | null;
  orderAgentForBonus: OrderAgentBonusContext | null;
  validatedGiftOverrides: Map<number, number>;
  tempOrderNumber: string;
  isInboundShelfReturn: boolean;
  stackPolicy: BonusStackPolicy;
};
