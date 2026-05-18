import type { CreatePeriodReturnBatchInput, PeriodReturnBatchResult } from "./returns-enhanced.types";
import { persistPeriodReturnBatch } from "./returns-enhanced.create-batch.persist";
import { preparePeriodReturnBatch } from "./returns-enhanced.create-batch.prepare";

export async function createPeriodReturnBatch(
  tenantId: number,
  input: CreatePeriodReturnBatchInput,
  actorUserId: number | null
): Promise<PeriodReturnBatchResult> {
  const prep = await preparePeriodReturnBatch(tenantId, input, actorUserId);
  return persistPeriodReturnBatch(prep);
}
