"use client";

import { ProductBulkCreateWorkspace } from "./product-bulk-create";

type Props = {
  tenantSlug: string | null;
  backHref: string;
  onDone: () => void;
  /** Eski API — endi ishlatilmaydi */
  showCardHeader?: boolean;
};

/** Bir nechta mahsulot — shablon uslubidagi grid forma */
export function ProductBulkAddPanel({ tenantSlug, backHref, onDone }: Props) {
  return (
    <ProductBulkCreateWorkspace tenantSlug={tenantSlug} backHref={backHref} onDone={onDone} />
  );
}
