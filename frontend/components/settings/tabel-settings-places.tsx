"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

export function TabelSettingsLocationsPanel() {
  const { tenantSlug } = useAuthStore();
  const canEdit = usePermissions().has("settings.tabel_pravila.update");
  const qc = useQueryClient();
  const [locName, setLocName] = useState("");
  const [locBranch, setLocBranch] = useState("");
  const [locLat, setLocLat] = useState("40.7821");
  const [locLng, setLocLng] = useState("72.3442");
  const [locRadius, setLocRadius] = useState("150");

  const locationsQ = useQuery({
    queryKey: ["tabel", "locations", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: Array<{ id: number; name: string; branch?: string; lat: number; lng: number; radius_m: number }> } }>(
        `/api/${tenantSlug}/tabel/locations`
      );
      return data.data.items ?? [];
    }
  });

  const addLocMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/${tenantSlug}/tabel/locations`, {
        name: locName,
        branch: locBranch.trim() || null,
        lat: Number(locLat),
        lng: Number(locLng),
        radius_m: Number(locRadius) || 150,
        require_comment_outside: true
      });
    },
    onSuccess: async () => {
      setLocName("");
      await qc.invalidateQueries({ queryKey: ["tabel", "locations", tenantSlug] });
    }
  });

  const delLocMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/tabel/locations/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "locations", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <h1 className="text-base font-bold">Локации и гео-зоны посещаемости (Офисы и Склады)</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Название точки</label>
          <Input value={locName} onChange={(e) => setLocName(e.target.value)} placeholder="Центральный офис" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Филиал</label>
          <Input value={locBranch} onChange={(e) => setLocBranch(e.target.value)} placeholder="Андижан" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Широта (Lat)</label>
          <Input value={locLat} onChange={(e) => setLocLat(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Долгота (Lng)</label>
          <Input value={locLng} onChange={(e) => setLocLng(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Input type="number" value={locRadius} onChange={(e) => setLocRadius(e.target.value)} placeholder="Радиус м" />
          <Button size="sm" disabled={!canEdit || !locName.trim()} onClick={() => void addLocMut.mutateAsync()}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <div className="divide-y rounded-lg border">
        {(locationsQ.data ?? []).map((loc) => (
          <div key={loc.id} className="flex items-center justify-between px-3 py-2 text-xs">
            <div>
              <MapPin className="mr-1 inline size-3.5 text-teal-700" />
              <b>{loc.name}</b> {loc.branch ? `(${loc.branch})` : ""} — {loc.lat}, {loc.lng} · радиус <b>{loc.radius_m} м</b>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-rose-600" disabled={!canEdit} onClick={() => void delLocMut.mutateAsync(loc.id)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TabelSettingsDictionariesPanel({
  absenceTypes,
  clearanceItems
}: {
  absenceTypes: Array<{ code: string; labelRu: string; labelUz?: string }>;
  clearanceItems: Array<{ code: string; labelRu: string; department?: string }>;
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <h1 className="text-base font-bold">Справочник видов отсутствий и обходного листа</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-3 text-xs">
          <div className="mb-2 font-bold">Виды заявок на отсутствие</div>
          <ul className="space-y-1">
            {absenceTypes.map((a) => (
              <li key={a.code} className="flex justify-between border-b py-1">
                <span>{a.labelRu} ({a.labelUz})</span>
                <span className="font-mono text-muted-foreground">{a.code}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-3 text-xs">
          <div className="mb-2 font-bold">Пункты обходного листа (при увольнении)</div>
          <ul className="space-y-1">
            {clearanceItems.map((c) => (
              <li key={c.code} className="flex justify-between border-b py-1">
                <span>{c.labelRu}</span>
                <span className="text-muted-foreground">{c.department}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
