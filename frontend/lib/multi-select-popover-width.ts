/** Trigger kengligiga mos popover — majburiy 380px yo‘q (kengayish titrashi). */
export function computeMultiSelectPopoverWidth(
  triggerWidth: number,
  minPopoverWidth: number,
  viewportWidth: number
): number {
  const floor = Math.max(0, Math.floor(minPopoverWidth));
  const raw = Math.max(Math.floor(triggerWidth) || 0, floor);
  const cap = Math.min(560, Math.max(16, viewportWidth - 16));
  return Math.min(Math.max(raw, floor), cap);
}
