"use client";

import { api } from "@/lib/api";
import { ReturnWaybillPrintView } from "@/components/orders/return-waybill-print-view";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type DetailLine = {
  id: number;
  product_id: number;
  product_sku: string;
  product_name: string;
  qty: string;
  paid_qty: string | null;
  bonus_qty: string | null;
};

type ReturnDetail = {
  number: string;
  status: string;
  created_at: string;
  client_name: string | null;
  order_number: string | null;
  warehouse_name: string;
  note: string | null;
  lines: DetailLine[];
};

/**
 * Qaytarish nakladnoyini chop etish overlay'i: detalni yuklab, ko'rinishni
 * portalda render qiladi va avtomatik `window.print()` chaqiradi.
 */
export function ReturnWaybillPrint({
  returnId,
  slug,
  expeditorName,
  onClose
}: {
  returnId: number;
  slug: string;
  expeditorName?: string | null;
  onClose: () => void;
}) {
  const detailQ = useQuery({
    queryKey: ["return-waybill-print", slug, returnId],
    enabled: Boolean(slug) && returnId > 0,
    queryFn: async () => {
      const { data } = await api.get<ReturnDetail>(`/api/${slug}/returns/${returnId}`);
      return data;
    }
  });

  const ready = detailQ.isSuccess && detailQ.data != null;

  useEffect(() => {
    if (!ready) return;
    document.body.setAttribute("data-return-print", "1");
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    const t = window.setTimeout(() => window.print(), 350);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.removeAttribute("data-return-print");
    };
  }, [ready, onClose]);

  if (typeof document === "undefined") return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[10200] overflow-auto bg-white p-4"
      data-testid="return-waybill-print-overlay"
    >
      <div className="no-print mb-4 flex items-center gap-3 border-b border-neutral-200 pb-3">
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
          onClick={onClose}
        >
          Закрыть
        </button>
        {detailQ.isLoading && <span className="text-sm text-neutral-600">Загрузка…</span>}
        {detailQ.isError && (
          <span className="text-sm text-rose-600">Не удалось загрузить накладную.</span>
        )}
      </div>

      {ready && detailQ.data && (
        <ReturnWaybillPrintView
          doc={{
            number: detailQ.data.number,
            status: detailQ.data.status,
            created_at: detailQ.data.created_at,
            client_name: detailQ.data.client_name,
            order_number: detailQ.data.order_number,
            warehouse_name: detailQ.data.warehouse_name,
            expeditor_name: expeditorName ?? null,
            note: detailQ.data.note
          }}
          lines={detailQ.data.lines.map((l) => ({
            id: l.id,
            product_sku: l.product_sku,
            product_name: l.product_name,
            qty: l.qty
          }))}
        />
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
