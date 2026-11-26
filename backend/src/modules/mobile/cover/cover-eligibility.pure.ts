import {
  COVER_ALREADY_ACTIVE,
  COVER_NOT_LINKED,
  CoverError
} from "./cover-codes";

/** Agent.supervisor_user_id must equal SVR user id. */
export function assertLinkedPair(
  agentSupervisorUserId: number | null | undefined,
  svrUserId: number
): void {
  if (!agentSupervisorUserId || agentSupervisorUserId !== svrUserId) {
    throw new CoverError(COVER_NOT_LINKED);
  }
}

export function assertOneActivePerDay(hasActiveSameDay: boolean): void {
  if (hasActiveSameDay) {
    throw new CoverError(COVER_ALREADY_ACTIVE);
  }
}
