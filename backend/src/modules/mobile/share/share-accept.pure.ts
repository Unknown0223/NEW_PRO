export type PartialAcceptResult = {
  kind: "full" | "partial" | "reject";
  accepted: number[];
  rejectedUnlock: number[];
};

export function applyPartialAccept(input: {
  orderIds: number[];
  acceptedIds: number[];
}): PartialAcceptResult {
  const set = new Set(input.acceptedIds);
  const accepted = input.orderIds.filter((id) => set.has(id));
  const rejectedUnlock = input.orderIds.filter((id) => !set.has(id));
  if (accepted.length === 0) {
    return { kind: "reject", accepted: [], rejectedUnlock: [...input.orderIds] };
  }
  if (rejectedUnlock.length === 0) {
    return { kind: "full", accepted, rejectedUnlock: [] };
  }
  return { kind: "partial", accepted, rejectedUnlock };
}
