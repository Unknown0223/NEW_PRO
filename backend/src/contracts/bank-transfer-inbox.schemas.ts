import { z } from "zod";

export const bankTransferInboxStatusSchema = z.enum([
  "unmatched",
  "ambiguous",
  "matched",
  "pending",
  "done",
  "ignored"
]);

export const bankTransferInboxSourceSchema = z.enum([
  "excel",
  "csv",
  "manual",
  "bank_api",
  "one_c"
]);

/** Filter / UI: Вручную vs Банк/1С (excel|csv|bank_api|one_c). */
export const bankTransferChannelSchema = z.enum(["manual", "bank_verified"]);

export const bankTransferIngestItemSchema = z.object({
  external_id: z.string().trim().min(1).max(128).optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(8).optional().nullable(),
  paid_at: z.string().max(40).optional().nullable(),
  payer_name: z.string().max(500).optional().nullable(),
  payer_inn: z.string().max(32).optional().nullable(),
  payer_pinfl: z.string().max(20).optional().nullable(),
  payer_bank_account: z.string().max(64).optional().nullable(),
  payer_bank_mfo: z.string().max(32).optional().nullable(),
  payer_client_code: z.string().max(32).optional().nullable(),
  purpose: z.string().max(2000).optional().nullable(),
  raw: z.record(z.string(), z.unknown()).optional().nullable(),
  cash_desk_id: z.number().int().positive().optional().nullable()
});

export const bankTransferIngestBodySchema = z.object({
  source: bankTransferInboxSourceSchema.default("manual"),
  items: z.array(bankTransferIngestItemSchema).min(1).max(500)
});

export const bankTransferAssignBodySchema = z.object({
  client_id: z.number().int().positive(),
  comment: z.string().trim().min(3).max(2000),
  create_payment: z.boolean().optional().default(true),
  cash_desk_id: z.number().int().positive().optional().nullable(),
  payment_type: z.string().trim().min(1).max(64).optional().nullable()
});

export const bankTransferReassignBodySchema = z.object({
  client_id: z.number().int().positive(),
  comment: z.string().trim().min(3).max(2000)
});

export const bankTransferCommentBodySchema = z.object({
  comment: z.string().trim().min(1).max(2000)
});

export const bankTransferIgnoreBodySchema = z.object({
  comment: z.string().trim().min(1).max(2000).optional().nullable()
});

export const bankTransferCreatePaymentBodySchema = z.object({
  cash_desk_id: z.number().int().positive().optional().nullable(),
  payment_type: z.string().trim().min(1).max(64).optional().nullable()
});

/** Kassir: qo‘lda перечисление (source=manual) → pending to‘lov. */
export const bankTransferManualCreateBodySchema = z.object({
  amount: z.number().positive(),
  client_id: z.number().int().positive(),
  paid_at: z.string().max(40).optional().nullable(),
  comment: z.string().trim().min(1).max(2000),
  payer_name: z.string().max(500).optional().nullable(),
  cash_desk_id: z.number().int().positive().optional().nullable(),
  payment_type: z.string().trim().min(1).max(64).optional().nullable(),
  create_payment: z.boolean().optional().default(true)
});

export type BankTransferIngestBody = z.infer<typeof bankTransferIngestBodySchema>;
export type BankTransferIngestItem = z.infer<typeof bankTransferIngestItemSchema>;
export type BankTransferManualCreateBody = z.infer<typeof bankTransferManualCreateBodySchema>;
export type BankTransferChannel = z.infer<typeof bankTransferChannelSchema>;
