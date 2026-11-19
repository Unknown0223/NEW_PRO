/**
 * Characterization fixtures: card_net (loadLedgerCardNetByClient).
 * expected_net — qo‘lda; SQL o‘zgarmaydi. Tashqarida: effective_balance, legacy_header_balance.
 */

export type CardNetOrderEvent = {
  type: "order";
  ref: string;
  total: string;
  status: string;
  order_type?: "order" | "return" | "return_by_order" | "partial_return";
  created_at?: string;
};

export type CardNetPaymentEvent = {
  type: "payment";
  amount: string;
  entry_kind?: "payment" | "refund" | "client_expense";
  workflow_status?: string;
  deleted_at?: string | null;
  order_ref?: string;
  note?: string;
  paid_at?: string;
  note_sr_ref?: string;
};

export type CardNetSalesReturnEvent = {
  type: "sales_return";
  ref: string;
  number: string;
  refund_amount: string;
  status?: string;
  mirror_order_ref?: string;
  order_ref?: string;
  accepted_at?: string;
};

export type CardNetBalanceEvent = { type: "client_balance"; balance: string };

export type CardNetEvent =
  | CardNetOrderEvent
  | CardNetPaymentEvent
  | CardNetSalesReturnEvent
  | CardNetBalanceEvent;

export type CardNetClientSpec = { key: string; expected_net: string; events: CardNetEvent[] };

export type CardNetCase = {
  id: string;
  title: string;
  rule: string;
  asOfEnd?: string | null;
  clients: CardNetClientSpec[];
};

export const CN_T0 = "2026-01-10T10:00:00.000Z";
export const CN_T1 = "2026-01-15T10:00:00.000Z";
export const CN_CUT = "2026-01-12T23:59:59.999Z";
export const CN_T2 = "2026-01-20T10:00:00.000Z";

function o(
  ref: string,
  total: string,
  status: string,
  extra: Partial<Omit<CardNetOrderEvent, "type" | "ref" | "total" | "status">> = {}
): CardNetOrderEvent {
  return { type: "order", ref, total, status, created_at: CN_T0, ...extra };
}

function pay(
  amount: string,
  extra: Partial<Omit<CardNetPaymentEvent, "type" | "amount">> = {}
): CardNetPaymentEvent {
  return {
    type: "payment",
    amount,
    entry_kind: "payment",
    workflow_status: "confirmed",
    paid_at: CN_T1,
    ...extra
  };
}

function one(
  id: string,
  title: string,
  rule: string,
  expected_net: string,
  events: CardNetEvent[],
  asOfEnd?: string | null
): CardNetCase {
  return {
    id,
    title,
    rule,
    asOfEnd,
    clients: [{ key: "a", expected_net, events }]
  };
}

export const CARD_NET_CASES: CardNetCase[] = [
  one("CN-01", "Bo‘sh mijoz", "Hujjatsiz client card_net = 0", "0", []),
  one(
    "CN-02",
    "Faqat delivered order qarz; confirmed kirmaydi",
    "order_type=order va status=delivered → debt; confirmed hisobga kirmaydi",
    "-100.00",
    [o("o_conf", "500.00", "confirmed"), o("o_del", "100.00", "delivered")]
  ),
  one(
    "CN-03",
    "Delivered 100 + payment 40",
    "pay − debt; allocation e’tiborsiz",
    "-60.00",
    [o("o1", "100.00", "delivered"), pay("40.00")]
  ),
  one(
    "CN-04",
    "To‘liq yopilish",
    "delivered 100 + payment 100 → net 0",
    "0.00",
    [o("o1", "100.00", "delivered"), pay("100.00")]
  ),
  one(
    "CN-05",
    "Peredoplata",
    "payment > debt → musbat card_net",
    "50.00",
    [o("o1", "100.00", "delivered"), pay("150.00")]
  ),
  one(
    "CN-06",
    "client_expense qo‘shimcha qarz",
    "entry_kind=client_expense → debt",
    "-120.00",
    [o("o1", "100.00", "delivered"), pay("20.00", { entry_kind: "client_expense" })]
  ),
  one(
    "CN-07",
    "pending_confirmation yopmaydi",
    "PAYMENT_COUNTS_FOR_RECEIVABLE_NET — pending kirmaydi",
    "-100.00",
    [o("o1", "100.00", "delivered"), pay("40.00", { workflow_status: "pending_confirmation" })]
  ),
  one(
    "CN-08",
    "rejected va deleted workflow",
    "rejected/deleted workflow qarzni yopmaydi",
    "-100.00",
    [
      o("o1", "100.00", "delivered"),
      pay("30.00", { workflow_status: "rejected" }),
      pay("30.00", { workflow_status: "deleted" })
    ]
  ),
  one(
    "CN-09",
    "Soft-deleted payment",
    "deleted_at IS NULL — soft delete netga kirmaydi",
    "-100.00",
    [o("o1", "100.00", "delivered"), pay("40.00", { deleted_at: CN_T2 })]
  ),
  one(
    "CN-10",
    "Return order krediti (mirror yo‘q)",
    "finished return order → pay (mirror/refund yo‘q)",
    "-60.00",
    [
      o("o1", "100.00", "delivered"),
      o("r1", "40.00", "delivered", { order_type: "return", created_at: CN_T1 })
    ]
  ),
  one(
    "CN-11",
    "Return + posted sales_return mirror — bir marta kredit",
    "mirror SR bo‘lsa return order pay yo‘q; SR refund_amount bir marta",
    "-60.00",
    [
      o("o1", "100.00", "delivered"),
      o("r1", "40.00", "delivered", { order_type: "return", created_at: CN_T1 }),
      {
        type: "sales_return",
        ref: "sr1",
        number: "SR-CN11",
        refund_amount: "40.00",
        status: "posted",
        mirror_order_ref: "r1",
        accepted_at: CN_T1
      }
    ]
  ),
  one(
    "CN-12",
    "Return + refund payment on return order",
    "refund order_id=return → return pay yo‘q; refund pay qo‘shiladi",
    "-60.00",
    [
      o("o1", "100.00", "delivered"),
      o("r1", "40.00", "delivered", { order_type: "return", created_at: CN_T1 }),
      pay("40.00", { entry_kind: "refund", order_ref: "r1" })
    ]
  ),
  one(
    "CN-13",
    "SR + note mirror refund",
    "note Возврат · {number} → SR pay yo‘q; refund pay",
    "-60.00",
    [
      o("o1", "100.00", "delivered"),
      {
        type: "sales_return",
        ref: "sr1",
        number: "SR-CN13",
        refund_amount: "40.00",
        status: "posted",
        accepted_at: CN_T1
      },
      pay("40.00", { entry_kind: "refund", note_sr_ref: "sr1" })
    ]
  ),
  one(
    "CN-14",
    "PAYMENT_NOT_RETURN_MIRROR",
    "return orderga bog‘langan payment (summa ≈ return) pay sifatida kirmaydi",
    "0.00",
    [
      o("o1", "100.00", "delivered"),
      o("r1", "100.00", "delivered", { order_type: "return", created_at: CN_T1 }),
      pay("100.00", { order_ref: "r1" })
    ]
  ),
  one(
    "CN-15",
    "asOfEnd cut-off",
    "created_at / paid_at cut-off: keyingi payment kirmaydi",
    "-100.00",
    [o("o1", "100.00", "delivered"), pay("40.00", { paid_at: CN_T2 })],
    CN_CUT
  ),
  {
    id: "CN-16",
    title: "Batch ikki client",
    rule: "Har client_id o‘z neti; cross-client aralashmaydi",
    clients: [
      { key: "a", expected_net: "-100.00", events: [o("o1", "100.00", "delivered")] },
      {
        key: "b",
        expected_net: "50.00",
        events: [o("o1", "100.00", "delivered"), pay("150.00")]
      }
    ]
  },
  one(
    "CN-17",
    "seed_cache card_net ni buzmasin",
    "client_balances.balance (prepaid_cache) card_net ga ta’sir qilmaydi",
    "-60.00",
    [
      { type: "client_balance", balance: "999999.00" },
      o("o1", "100.00", "delivered"),
      pay("40.00")
    ]
  )
];
