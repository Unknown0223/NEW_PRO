// ─────────────────────────────────────────────────────────────
// API INTEGRATION LAYER (simulated Axios + React Query calls)
//   GET  /payment-history/{id}
//   GET  /payment-history/audit/{id}
//   POST /payment-history/approve
//   POST /payment-history/reject
//   PUT  /payment-history/update
//   GET  /payment-history/pdf/{id}
// ─────────────────────────────────────────────────────────────
import {
  MOCK_AUDIT,
  MOCK_PAYMENT,
  type AuditEntry,
  type Payment,
} from "../data/payment";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function getPayment(id: number): Promise<Payment> {
  await delay(900);
  return { ...MOCK_PAYMENT, id };
}

export async function getAudit(_id: number): Promise<AuditEntry[]> {
  await delay(900);
  return [...MOCK_AUDIT];
}

export async function approvePayment(p: Payment, user: string): Promise<Payment> {
  await delay(1100);
  const now = new Date().toISOString();
  return {
    ...p,
    status: "APPROVED",
    updatedAt: now,
    modifiedBy: { id: 99, fullName: user },
    approval: {
      status: "APPROVED",
      approvedBy: { id: 99, fullName: user },
      approvedAt: now,
      rejectReason: null,
    },
  };
}

export async function rejectPayment(p: Payment, user: string, reason: string): Promise<Payment> {
  await delay(1100);
  const now = new Date().toISOString();
  return {
    ...p,
    status: "REJECTED",
    updatedAt: now,
    modifiedBy: { id: 99, fullName: user },
    comment: p.comment ? `${p.comment}\nПричина отклонения: ${reason}` : `Причина отклонения: ${reason}`,
    approval: {
      status: "REJECTED",
      approvedBy: { id: 99, fullName: user },
      approvedAt: now,
      rejectReason: reason,
    },
  };
}

export async function generatePdf(_id: number): Promise<void> {
  await delay(1400);
}
