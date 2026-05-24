"use client";

import { useOrdersListPagePart1 } from "./use-orders-list-page.part1";
import { useOrdersListPagePart2 } from "./use-orders-list-page.part2";

export function useOrdersListPage() {
  const p1 = useOrdersListPagePart1();
  const p2 = useOrdersListPagePart2(p1);
  return { ...p1, ...p2 };
}

export type UseOrdersListPageResult = ReturnType<typeof useOrdersListPage>;
