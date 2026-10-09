/** Asosiy 4 ustundan birortasi bo‘sh bo‘lsa — qator o‘tkazib yuboriladi. */
export function isIncompleteOpeningBalanceImportRow(input: {
  clientId: string;
  region: string;
  agentCode: string;
  amount: string;
}): boolean {
  return (
    !input.clientId.trim() ||
    !input.region.trim() ||
    !input.agentCode.trim() ||
    !input.amount.trim()
  );
}
