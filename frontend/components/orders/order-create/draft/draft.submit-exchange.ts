"use client";

import { api } from "@/lib/api";
import { newClientUuid } from "@/lib/client-uuid";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import {
  buildExchangeCreateBody,
  buildExchangePairRows
} from "@/components/orders/exchange-order-create-panel";
import type { OrderCreateContextResponse } from "./draft.types";

export type ExchangeSubmitCtx = {
  tenantSlug: string;
  clientId: string;
  warehouseId: string;
  agentId: string;
  expeditorUserId: string;
  priceType: string;
  orderComment: string;
  orderNotePreset: string;
  requestTypeRef: string;
  orderCreatedAtLocal: string;
  exchangeSourceOrderIds: number[];
  exMinusKey: string;
  exMinusQty: string;
  exPlusProductId: string;
  exPlusQty: string;
  exchangeItems:
    | Array<{
        product_id: number;
        sku: string;
        name: string;
        unit: string;
        qty: string;
        price: string;
        is_bonus: boolean;
        order_id?: number;
        order_number?: string;
      }>
    | undefined;
  ctxProfile: OrderCreateContextResponse["settings_profile"] | undefined;
};

export async function runExchangeSubmit(ctx: ExchangeSubmitCtx): Promise<void> {
  const pairRows = buildExchangePairRows(ctx.exchangeItems);
  const built = buildExchangeCreateBody({
    sourceOrderIds: ctx.exchangeSourceOrderIds,
    minusKey: ctx.exMinusKey,
    minusQty: ctx.exMinusQty,
    plusProductId: ctx.exPlusProductId,
    plusQty: ctx.exPlusQty,
    pairRows
  });
  if (!built.ok) throw new Error(`exchange_${built.reason}`);
  const cid = Number.parseInt(ctx.clientId, 10);
  if (!Number.isFinite(cid) || cid < 1) throw new Error("client");
  const wid = Number.parseInt(ctx.warehouseId, 10);
  if (!ctx.warehouseId.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");
  const agentParsed = ctx.agentId.trim() ? Number.parseInt(ctx.agentId, 10) : NaN;
  const agent_id = Number.isFinite(agentParsed) && agentParsed > 0 ? agentParsed : null;
  if (agent_id == null) throw new Error("agent");
  const freeComment = ctx.orderComment.trim();
  const presetStored = ctx.orderNotePreset.trim();
  let commentOut: string | null = freeComment || null;
  if (presetStored) {
    const presetLabel =
      refEntryLabelByStored(ctx.ctxProfile?.references?.order_note_entries, presetStored) ??
      presetStored;
    commentOut = freeComment ? `${presetLabel}\n${freeComment}` : presetLabel;
  }
  const body: Record<string, unknown> = {
    client_id: cid,
    warehouse_id: wid,
    agent_id,
    price_type: ctx.priceType.trim() || "retail",
    order_type: "exchange",
    apply_bonus: false,
    items: [],
    comment: commentOut,
    request_type_ref: ctx.requestTypeRef.trim() || null,
    ...built.body
  };
  const expRaw = ctx.expeditorUserId.trim();
  if (expRaw === "__none__") body.expeditor_user_id = null;
  else if (expRaw !== "") {
    const eid = Number.parseInt(expRaw, 10);
    if (Number.isFinite(eid) && eid > 0) body.expeditor_user_id = eid;
  }
  body.client_uuid = newClientUuid();
  {
    const createdAt = new Date(ctx.orderCreatedAtLocal);
    if (!Number.isNaN(createdAt.getTime())) {
      body.created_at = createdAt.toISOString();
    }
  }
  await api.post(`/api/${ctx.tenantSlug}/orders`, body);
}
