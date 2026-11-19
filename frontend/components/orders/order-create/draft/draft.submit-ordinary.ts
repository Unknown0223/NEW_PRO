"use client";

import { api } from "@/lib/api";
import { newClientUuid } from "@/lib/client-uuid";
import { ORDER_TYPE_VALUES } from "@/lib/order-types";
import { refEntryLabelByStored } from "@/lib/profile-ref-entries";
import { paymentMethodIdForPriceType } from "../view/polki-shelf-return/polki-apply-order-defaults";
import type { PolkiPriceTypeEntryRef } from "../view/polki-shelf-return/polki-price-type-options";
import { currentMonthEndIsoDate } from "../utils";
import { buildOrdinaryItems } from "./draft.logic";
import type { OrderCreateContextResponse } from "./draft.types";
import type { OrderDetailRow } from "@/components/orders/order-detail-view";

export type OrdinarySubmitCtx = {
  tenantSlug: string;
  clientId: string;
  warehouseId: string;
  agentId: string;
  expeditorUserId: string;
  priceType: string;
  orderComment: string;
  orderNotePreset: string;
  requestTypeRef: string;
  orderType: string | undefined;
  applyBonus: boolean;
  applyDiscount: boolean;
  paymentMethodRef: string;
  orderIsConsignment: boolean;
  consignmentDueDate: string;
  orderCreatedAtLocal: string;
  qtyByProductId: Record<number, string>;
  stockRows: { product_id: number; qty: string; reserved_qty: string }[] | undefined;
  isEditMode: boolean;
  editOrderId: number | null;
  editSourceWarehouseId: number | null;
  editReservedQtyByProduct: Record<number, number>;
  editOrder: OrderDetailRow | undefined;
  createCtx: OrderCreateContextResponse | undefined;
  ctxProfile: OrderCreateContextResponse["settings_profile"] | undefined;
  paymentMethodSelectOptions: { id: string; name: string }[];
  requiresPaymentMethodForSubmit: boolean;
  showOrderPaymentMethodSelector: boolean;
  priceAsOf: string | null | undefined;
  oldPricesEnabled: boolean;
  bonusConfirm?: {
    bonus_gift_lines?: { bonus_rule_id: number; product_id: number; qty: number }[];
    bonus_strategy_selections?: { strategy_id: number; rule_ids: number[] }[];
  } | void;
};

export async function runOrdinaryOrEditSubmit(ctx: OrdinarySubmitCtx): Promise<void> {
  const {
    tenantSlug,
    clientId,
    warehouseId,
    agentId,
    expeditorUserId,
    priceType,
    orderComment,
    orderNotePreset,
    requestTypeRef,
    orderType,
    applyBonus,
    applyDiscount,
    paymentMethodRef,
    orderIsConsignment,
    consignmentDueDate,
    orderCreatedAtLocal,
    qtyByProductId,
    stockRows,
    isEditMode,
    editOrderId,
    editSourceWarehouseId,
    editReservedQtyByProduct,
    editOrder,
    createCtx,
    ctxProfile,
    paymentMethodSelectOptions,
    requiresPaymentMethodForSubmit,
    showOrderPaymentMethodSelector,
    priceAsOf,
    oldPricesEnabled,
    bonusConfirm
  } = ctx;

  const cid = Number.parseInt(clientId, 10);
  if (!Number.isFinite(cid) || cid < 1) throw new Error("client");

  const warehouseRaw =
    warehouseId.trim() ||
    (isEditMode && editSourceWarehouseId != null ? String(editSourceWarehouseId) : "");
  const wid = Number.parseInt(warehouseRaw, 10);
  if (!warehouseRaw.trim() || !Number.isFinite(wid) || wid < 1) throw new Error("warehouse");

  const validatedOrderType =
    orderType && (ORDER_TYPE_VALUES as readonly string[]).includes(orderType) ? orderType : "order";

  const agentParsed = agentId.trim() ? Number.parseInt(agentId, 10) : NaN;
  const agent_id = Number.isFinite(agentParsed) && agentParsed > 0 ? agentParsed : null;

  if (validatedOrderType === "order") {
    if (agent_id == null) throw new Error("agent");
    if (requiresPaymentMethodForSubmit) {
      if (paymentMethodSelectOptions.length === 0) throw new Error("payment_method_empty");
      const pm = paymentMethodRef.trim().slice(0, 64);
      if (!pm) throw new Error("payment_method");
    }
  }

  const sameWh =
    isEditMode &&
    editSourceWarehouseId != null &&
    Number.isFinite(wid) &&
    wid === editSourceWarehouseId;
  const built = buildOrdinaryItems({
    qtyByProductId,
    stockRows,
    sameWarehouseAsEdit: Boolean(sameWh),
    editReservedQtyByProduct
  });
  if (!built.ok) throw new Error(built.reason);
  const items = built.items;

  const freeComment = orderComment.trim();
  const presetStored = orderNotePreset.trim();
  let commentOut: string | null = freeComment || null;
  if (presetStored) {
    const presetLabel =
      refEntryLabelByStored(ctxProfile?.references?.order_note_entries, presetStored) ??
      presetStored;
    commentOut = freeComment ? `${presetLabel}\n${freeComment}` : presetLabel;
  }

  if (isEditMode && editOrderId != null) {
    const ptEntries = (createCtx?.settings_profile?.references?.price_type_entries ??
      []) as PolkiPriceTypeEntryRef[];
    const mappedPm = paymentMethodIdForPriceType(
      priceType,
      ptEntries,
      paymentMethodSelectOptions,
      ctxProfile?.references?.payment_method_entries ?? []
    );
    const pmOut = (mappedPm || paymentMethodRef).trim().slice(0, 64);
    const linesBody: Record<string, unknown> = {
      price_type: priceType.trim() || "retail",
      apply_bonus: applyBonus,
      apply_discount: applyDiscount,
      items
    };
    if (bonusConfirm?.bonus_gift_lines?.length) {
      linesBody.bonus_gift_lines = bonusConfirm.bonus_gift_lines;
    }
    if (bonusConfirm?.bonus_strategy_selections?.length) {
      linesBody.bonus_strategy_selections = bonusConfirm.bonus_strategy_selections;
    }
    if (validatedOrderType === "order" && (showOrderPaymentMethodSelector || Boolean(pmOut))) {
      if (pmOut) linesBody.payment_method_ref = pmOut;
    }
    await api.patch(`/api/${tenantSlug}/orders/${editOrderId}`, linesBody);

    const metaBody: Record<string, unknown> = { comment: commentOut };
    const expRaw = expeditorUserId.trim();
    if (expRaw === "__none__") metaBody.expeditor_user_id = null;
    else if (expRaw !== "") {
      const eid = Number.parseInt(expRaw, 10);
      if (Number.isFinite(eid) && eid > 0) metaBody.expeditor_user_id = eid;
    }
    await api.patch(`/api/${tenantSlug}/orders/${editOrderId}/meta`, metaBody);

    const origCons = Boolean(editOrder?.is_consignment);
    const origDue = (editOrder?.consignment_due_date ?? "").trim().slice(0, 10);
    const nextDue = orderIsConsignment ? consignmentDueDate.trim().slice(0, 10) : "";
    if (orderIsConsignment !== origCons || origDue !== nextDue) {
      const consRes = await api.post<{
        updated?: number[];
        failed?: { id: number; error: string }[];
      }>(`/api/${tenantSlug}/orders/bulk/consignment`, {
        order_ids: [editOrderId],
        is_consignment: orderIsConsignment,
        consignment_due_date: orderIsConsignment ? consignmentDueDate.trim() || null : null
      });
      if ((consRes.data.failed ?? []).length > 0) {
        throw new Error("consignment_patch");
      }
    }
    return;
  }

  const body: Record<string, unknown> = {
    client_id: cid,
    warehouse_id: wid,
    agent_id,
    price_type: priceType.trim() || "retail",
    order_type: validatedOrderType,
    apply_bonus: applyBonus,
    apply_discount: applyDiscount,
    comment: commentOut,
    request_type_ref: requestTypeRef.trim() || null,
    items
  };
  if (priceAsOf && oldPricesEnabled) {
    body.price_as_of = priceAsOf;
  }
  {
    const createdAt = new Date(orderCreatedAtLocal);
    if (!Number.isNaN(createdAt.getTime())) {
      body.created_at = createdAt.toISOString();
    }
  }
  if (validatedOrderType === "order" && orderIsConsignment) {
    body.is_consignment = true;
    const due = consignmentDueDate.trim() || currentMonthEndIsoDate();
    body.consignment_due_date = due;
  }
  const expRaw = expeditorUserId.trim();
  if (expRaw === "__none__") body.expeditor_user_id = null;
  else if (expRaw !== "") {
    const eid = Number.parseInt(expRaw, 10);
    if (Number.isFinite(eid) && eid > 0) body.expeditor_user_id = eid;
  }
  if (validatedOrderType === "order" && showOrderPaymentMethodSelector) {
    body.payment_method_ref = paymentMethodRef.trim().slice(0, 64);
  }

  body.client_uuid = newClientUuid();
  await api.post(`/api/${tenantSlug}/orders`, body);
}
