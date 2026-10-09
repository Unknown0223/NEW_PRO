export function scrollEdgeVisibility(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  pad = 4
): { up: boolean; down: boolean } {
  const overflow = scrollHeight - clientHeight > pad;
  if (!overflow) return { up: false, down: false };
  return {
    up: scrollTop > pad,
    down: scrollTop + clientHeight < scrollHeight - pad
  };
}
