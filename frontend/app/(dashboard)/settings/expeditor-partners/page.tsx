"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";

type PartnerRow = { id: number; partner_user_id: number; name: string };

export default function ExpeditorPartnersPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [ownerId, setOwnerId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [mode, setMode] = useState<"own_warehouse" | "partners" | "">("");
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantSlug || !ownerId) return;
    setError(null);
    try {
      const { data } = await api.get<{
        data: { mode: "own_warehouse" | "partners"; partners: PartnerRow[] };
      }>(`/api/${tenantSlug}/staff/expeditors/${ownerId}/share-partners`);
      setMode(data.data.mode);
      setPartners(data.data.partners ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yuklash xato");
    }
  }, [tenantSlug, ownerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hydrated || !tenantSlug) {
    return <p className="text-sm text-muted-foreground">Sessiya…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Ulashish partnyorlari</h1>
      <p className="text-sm text-muted-foreground">
        Bo‘sh ro‘yxat — qabulchi sifatida faqat o‘z ombori ekspeditorlari.
        Partnyor qo‘shilsa — faqat shular.
      </p>
      <label className="block text-sm">
        Ekspeditor user id
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <button
        type="button"
        className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
        onClick={() => void load()}
      >
        Yuklash
      </button>
      {mode === "own_warehouse" ? (
        <p className="text-sm">Rejim: o‘z ombori (partnyor yo‘q)</p>
      ) : mode === "partners" ? (
        <p className="text-sm">Rejim: faqat partnyorlar</p>
      ) : null}
      <ul className="space-y-2">
        {partners.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded border px-3 py-2"
          >
            <span>{p.name || `User #${p.partner_user_id}`}</span>
            <button
              type="button"
              className="text-sm text-red-700"
              onClick={async () => {
                await api.delete(
                  `/api/${tenantSlug}/staff/expeditors/${ownerId}/share-partners/${p.id}`
                );
                await load();
              }}
            >
              O‘chirish
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="Partnyor user id"
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          inputMode="numeric"
        />
        <button
          type="button"
          className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
          onClick={async () => {
            const pid = Number(partnerId);
            if (!Number.isFinite(pid)) return;
            await api.post(
              `/api/${tenantSlug}/staff/expeditors/${ownerId}/share-partners`,
              { partner_user_id: pid }
            );
            setPartnerId("");
            await load();
          }}
        >
          Qo‘shish
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
