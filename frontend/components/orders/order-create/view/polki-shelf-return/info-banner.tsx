"use client";

import type { OrderCreateVm } from "../../hooks/use-order-create";
import { orderStatusLabelRu } from "../../utils";
import { POLKI_RETURN_MODE_META } from "./polki-return-mode";

export function PolkiInfoBanner({ vm }: { vm: OrderCreateVm }) {
  const { isPolkiByOrder } = vm;
  const mode = isPolkiByOrder ? POLKI_RETURN_MODE_META.by_order : POLKI_RETURN_MODE_META.free;

  return (
    <div
      className="rounded-lg border border-emerald-600/25 bg-emerald-600/5 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground"
      role="note"
    >
      <span className="font-medium text-foreground">{mode.shortLabel}: </span>
      {mode.bannerLead}{" "}
      Учитываются только продажи «{orderStatusLabelRu("delivered")}»; приход — на{" "}
      <span className="font-medium text-foreground">склад возврата</span>.
    </div>
  );
}
