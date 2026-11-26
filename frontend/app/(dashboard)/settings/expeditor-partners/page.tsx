"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { api } from "@/lib/api";
import {
  staffPickerDisplayName,
  staffPickerSearchText
} from "@/lib/person-display";

type PartnerRow = { id: number; partner_user_id: number; name: string };
type ExpeditorOpt = {
  id: number;
  fio?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  login?: string | null;
};

export default function ExpeditorPartnersPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [ownerId, setOwnerId] = useState<number | "">("");
  const [partnerId, setPartnerId] = useState<number | "">("");
  const [ownerQuery, setOwnerQuery] = useState("");
  const [partnerQuery, setPartnerQuery] = useState("");
  const [expeditors, setExpeditors] = useState<ExpeditorOpt[]>([]);
  const [mode, setMode] = useState<"own_warehouse" | "partners" | "">("");
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadExpeditors = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const { data } = await api.get<{ data: ExpeditorOpt[] }>(
        `/api/${tenantSlug}/expeditors`,
        { params: { picker: "1" } }
      );
      setExpeditors(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ekspeditorlar yuklanmadi");
    }
  }, [tenantSlug]);

  useEffect(() => {
    void loadExpeditors();
  }, [loadExpeditors]);

  const load = useCallback(async () => {
    if (!tenantSlug || ownerId === "") return;
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

  const filteredOwners = useMemo(() => {
    const q = ownerQuery.trim().toLowerCase();
    return expeditors.filter((e) => {
      if (!q) return true;
      return staffPickerSearchText(e).toLowerCase().includes(q);
    });
  }, [expeditors, ownerQuery]);

  const filteredPartners = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    return expeditors
      .filter((e) => e.id !== ownerId)
      .filter((e) => {
        if (!q) return true;
        return staffPickerSearchText(e).toLowerCase().includes(q);
      });
  }, [expeditors, ownerId, partnerQuery]);

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
        Ekspeditor (egasi)
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="Qidiruv (nom / login)"
          value={ownerQuery}
          onChange={(e) => setOwnerQuery(e.target.value)}
        />
        <select
          className="mt-2 w-full rounded border px-3 py-2"
          value={ownerId === "" ? "" : String(ownerId)}
          onChange={(e) => {
            const v = e.target.value;
            setOwnerId(v ? Number(v) : "");
            setPartnerId("");
          }}
        >
          <option value="">Tanlang…</option>
          {filteredOwners.map((e) => (
            <option key={e.id} value={e.id}>
              {staffPickerDisplayName(e)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
        onClick={() => void load()}
        disabled={ownerId === ""}
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
            <span>{p.name?.trim() || "—"}</span>
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

      <div className="space-y-2">
        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Partnyor qidiruv (nom)"
          value={partnerQuery}
          onChange={(e) => setPartnerQuery(e.target.value)}
          disabled={ownerId === ""}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded border px-3 py-2"
            value={partnerId === "" ? "" : String(partnerId)}
            onChange={(e) => {
              const v = e.target.value;
              setPartnerId(v ? Number(v) : "");
            }}
            disabled={ownerId === ""}
          >
            <option value="">Partnyor tanlang…</option>
            {filteredPartners.map((e) => (
              <option key={e.id} value={e.id}>
                {staffPickerDisplayName(e)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
            disabled={ownerId === "" || partnerId === ""}
            onClick={async () => {
              if (ownerId === "" || partnerId === "") return;
              await api.post(
                `/api/${tenantSlug}/staff/expeditors/${ownerId}/share-partners`,
                { partner_user_id: partnerId }
              );
              setPartnerId("");
              await load();
            }}
          >
            Qo‘shish
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
