"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Cpu, KeyRound, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { getUserFacingError } from "@/lib/error-utils";
import { usePermissions } from "@/lib/use-permissions";

type DeviceRow = {
  id: number;
  name: string;
  vendor: string;
  serial_no: string | null;
  branch: string | null;
  pairing_code: string | null;
  tunnel_url: string | null;
  status: string;
  is_confirmed: boolean;
  is_linked: boolean;
  has_token: boolean;
  device_token: string | null;
  synced_faces_count: number;
  last_seen_at: string | null;
};

async function copyText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    /* clipboard API can fail when the tab is not focused */
  }
  const el = document.createElement("textarea");
  el.value = value;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-[12px] font-bold">{value}</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2"
        onClick={() =>
          void copyText(value).then(() => {
            setOk(true);
            window.setTimeout(() => setOk(false), 1500);
          })
        }
      >
        {ok ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="mr-1 size-3.5" />}
        {ok ? "Скопировано" : "Копировать"}
      </Button>
    </div>
  );
}

export function TabelDevicesWorkspace() {
  const { tenantSlug } = useAuthStore();
  const perms = usePermissions();
  const canCreate = perms.has("tabel.ustroystva.create");
  const canUpdate = perms.has("tabel.ustroystva.update");
  const canAssign = perms.has("tabel.ustroystva.assign");
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("hikvision");
  const [branch, setBranch] = useState("");
  const [serialNo, setSerialNo] = useState("");
  const [notice, setNotice] = useState<{ title: string; pairing?: string; token?: string } | null>(null);

  const devicesQ = useQuery({
    queryKey: ["tabel", "devices", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: DeviceRow[] } }>(`/api/${tenantSlug}/tabel/devices`);
      return data.data.items ?? [];
    }
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { pairing_code: string } }>(`/api/${tenantSlug}/tabel/devices`, {
        name,
        vendor,
        branch: branch.trim() || null,
        serial_no: serialNo.trim() || null
      });
      return data.data;
    },
    onSuccess: async (res) => {
      setName("");
      setNotice({
        title: "Терминал создан. Сначала подключите его по коду привязки. Токен появится после полного подключения.",
        pairing: res.pairing_code
      });
      await qc.invalidateQueries({ queryKey: ["tabel", "devices", tenantSlug] });
    }
  });

  const tokenMut = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ data: { device_token: string } }>(`/api/${tenantSlug}/tabel/devices/${id}/issue-token`, {});
      return data.data;
    },
    onSuccess: async (res) => {
      setNotice({ title: "Токен создан. Скопируйте и вставьте в терминал (X-Device-Token).", token: res.device_token });
      await qc.invalidateQueries({ queryKey: ["tabel", "devices", tenantSlug] });
    }
  });

  const syncMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/tabel/devices/${id}/sync-faces`, {});
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "devices", tenantSlug] });
    }
  });

  const delMut = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/${tenantSlug}/tabel/devices/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tabel", "devices", tenantSlug] });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h1 className="text-lg font-bold">Терминалы Face ID (Hikvision / ZKTeco / Office-Link) и Бригадный Киоск</h1>
        <p className="text-xs text-muted-foreground">
          Сначала создайте точку и подключите терминал по коду привязки. Токен (X-Device-Token) создаётся отдельно — только после полного подключения.
        </p>
        {notice ? (
          <div className="mt-3 space-y-2 rounded-lg border border-teal-500/40 bg-teal-50 p-3 text-teal-950">
            <div className="text-xs font-bold">{notice.title}</div>
            {notice.pairing ? <CopyField label="Код привязки (Pairing Code)" value={notice.pairing} /> : null}
            {notice.token ? <CopyField label="X-Device-Token" value={notice.token} /> : null}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Название терминала / точки</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Главный вход / Склад Андижан" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Тип устройства</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="hikvision">Hikvision ISAPI Face</option>
              <option value="zkteco">ZKTeco Face / Bio</option>
              <option value="office_link">Office-Link Android Tunnel</option>
              <option value="kiosk">Мобильный Бригадный Киоск</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Филиал</label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Андижан" />
          </div>
          <div className="flex items-end gap-2">
            <Input value={serialNo} onChange={(e) => setSerialNo(e.target.value)} placeholder="Серийный №" />
            <Button
              size="sm"
              disabled={!canCreate || !name.trim() || createMut.isPending}
              onClick={() => void createMut.mutateAsync().catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/50 text-[11px] font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Устройство</th>
              <th className="px-3 py-2.5">Тип / Филиал</th>
              <th className="px-3 py-2.5">Код привязки</th>
              <th className="px-3 py-2.5">Токен</th>
              <th className="px-3 py-2.5">Лица</th>
              <th className="px-3 py-2.5">Статус</th>
              <th className="px-3 py-2.5 text-right">Действие</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(devicesQ.data ?? []).map((dev) => (
              <tr key={dev.id}>
                <td className="px-3 py-2.5 font-semibold">
                  <Cpu className="mr-1.5 inline size-4 text-teal-700" />
                  {dev.name}
                </td>
                <td className="px-3 py-2.5">
                  {dev.vendor.toUpperCase()} {dev.branch ? `· ${dev.branch}` : ""}
                </td>
                <td className="px-3 py-2.5">{dev.pairing_code ? <CopyField label="Pairing" value={dev.pairing_code} /> : "—"}</td>
                <td className="min-w-[220px] px-3 py-2.5">
                  {!dev.is_linked ? (
                    <span className="text-[11px] text-muted-foreground">После подключения терминала</span>
                  ) : dev.device_token ? (
                    <CopyField label="X-Device-Token" value={dev.device_token} />
                  ) : (
                    <span className="text-[11px] text-muted-foreground">{dev.has_token ? "Токен скрыт — создайте новый" : "Токен ещё не создан"}</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <Users className="mr-1 inline size-3.5 text-muted-foreground" />
                  {dev.synced_faces_count} сотр.
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                      dev.is_linked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {dev.is_linked ? "Подключён" : "Ожидает"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={!canUpdate || !dev.is_linked || tokenMut.isPending}
                      title={dev.is_linked ? "Создать или заменить токен" : "Сначала подключите терминал"}
                      onClick={() => void tokenMut.mutateAsync(dev.id).catch((e) => window.alert(getUserFacingError(e, "Ошибка")))}
                    >
                      <KeyRound className="mr-1 size-3" />
                      {dev.has_token ? "Новый токен" : "Создать токен"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={!canAssign && !canUpdate} onClick={() => void syncMut.mutateAsync(dev.id)}>
                      <RefreshCw className="mr-1 size-3" /> Синхр. лица
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-rose-600" disabled={!canUpdate} onClick={() => void delMut.mutateAsync(dev.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
