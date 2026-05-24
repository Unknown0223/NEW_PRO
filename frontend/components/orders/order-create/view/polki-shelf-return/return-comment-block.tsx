"use client";

import type { OrderCreateVm } from "../../hooks/use-order-create";
import { ReturnCommentFields } from "./return-comment-fields";

/** @deprecated Используйте `ReturnCommentFields` напрямую. */
export function ReturnCommentBlock({ vm }: { vm: OrderCreateVm }) {
  return <ReturnCommentFields vm={vm} />;
}
