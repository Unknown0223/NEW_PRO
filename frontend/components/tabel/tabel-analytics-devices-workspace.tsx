"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Cpu, KeyRound, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { activeBranchNamesFromProfile, branchLabelLookup, branchVisibleName, type BranchRefRow } from "@/lib/branch-options";
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
  terminal_password?: string | null;
  recovery_email?: string | null;
  terminal_ip?: string | null;
  pending_confirm?: boolean;
};

const VENDORS = [
  { value: "hikvision", label: "Hikvision" },
  { value: "zkteco", label: "ZKTeco" },
  { value: "office_link", label: "Office-Link" },
  { value: "kiosk", label: "Киоск" }
] as const;

function vendorLabel(value: string): string {
  return VENDORS.find((v) => v.value === value)?.label ?? value;
}

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

function LinkCommand({
  devices,
  linkTarget,
  setLinkTarget,
  copied,
  setCopied
}: {
  devices: DeviceRow[];
  linkTarget: string;
  setLinkTarget: (v: string) => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const [devicePassword, setDevicePassword] = useState("");
  const dev = devices.find((d) => String(d.id) === linkTarget);
  if (dev?.pending_confirm) {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        Терминал «{dev.name}» отправил запрос. Нажмите «Подтвердить» в списке ниже. Пароль заново вводить не нужно.
      </div>
    );
  }
  const origin = typeof window === "undefined" ? "https://salesarena.sale" : window.location.origin;
  const apiBase = origin.includes("127.0.0.1") || origin.includes("localhost") ? "http://127.0.0.1:18080" : "https://api.salesarena.sale";
  const branchArg = (dev?.branch || "device").replace(/'/g, "''");
  const passArg = devicePassword.replace(/'/g, "''").replace(/`/g, "``").replace(/\$/g, "`$").replace(/"/g, "`\"");
  const tokenArg = (dev?.device_token || "").replace(/'/g, "''").replace(/`/g, "``").replace(/\$/g, "`$").replace(/"/g, "`\"");
  const command = dev?.pairing_code && devicePassword && tokenArg
    ? `powershell -NoProfile -ExecutionPolicy Bypass -Command "(New-Object Net.WebClient).DownloadFile('${origin}/link-face-terminal.ps1','C:\\Users\\Public\\salec-link.ps1'); powershell -NoProfile -ExecutionPolicy Bypass -File C:\\Users\\Public\\salec-link.ps1 -PairingCode ${dev.pairing_code} -DeviceToken '${tokenArg}' -Branch '${branchArg}' -Password '${passArg}' -IngestUrl ${apiBase}/api/aksit/mobile/attendance/device-ingest -LinkUrl ${apiBase}/api/aksit/mobile/attendance/device-link-request"`
    : "";
  return (
    <div className="mt-4 rounded-lg border bg-muted/30 p-3">
      <div className="mb-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <img src="/salec-link/icon.png" alt="" width={28} height={28} className="size-7 rounded-md" />
          Скачать Sales Arena Link
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/salec-link/SalesArena-Link-Setup.exe" download="SalesArena-Link-Setup.exe">
            <img src="/salec-link/icon.png" alt="" width={18} height={18} className="size-[18px] rounded-sm" />
            Windows · 57 МБ
          </a>
          <a className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium" href="/salec-link/SalesArena-Link-Android.apk" download="SalesArena-Link-Android.apk">
            <img src="/salec-link/icon.png" alt="" width={18} height={18} className="size-[18px] rounded-sm" />
            Android · 52 МБ
          </a>
          <a className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium" href="/salec-link/SalesArena-Link-portable.zip" download="SalesArena-Link-portable.zip">
            <img src="/salec-link/icon.png" alt="" width={18} height={18} className="size-[18px] rounded-sm" />
            Windows без установки · 46 МБ
          </a>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Нажмите один раз — браузер сразу сохранит файл. Установщик Windows не требует отдельной распаковки.</p>
      </div>
      <div className="text-xs font-semibold">Команда для компьютера в сети терминала</div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Выберите терминал и введите его пароль. Команда соберётся сама: филиал, код и пароль уже внутри. Вставьте её в PowerShell или CMD — вопросов больше не будет. Терминал привяжется к этому филиалу, новый пароль появится в карточке устройства.
      </p>
      <div className="mb-2">
        <label className="mb-1 block text-xs font-medium">Терминал / филиал</label>
        <select className="h-9 min-w-[180px] rounded-md border border-input bg-background px-2 text-sm" value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}>
          <option value="">Выберите</option>
          {devices.map((row) => (
            <option key={row.id} value={String(row.id)}>
              {row.name}
              {row.branch ? ` · ${row.branch}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2">
        <label className="mb-1 block text-xs font-medium">Пароль терминала</label>
        <Input className="h-9 max-w-xs" type="password" value={devicePassword} autoComplete="off" onChange={(e) => setDevicePassword(e.target.value)} placeholder="Только пароль терминала" />
      </div>
      <div className="mt-3 flex items-start gap-2">
        <pre className="min-h-9 flex-1 overflow-x-auto rounded-md border bg-zinc-950 px-3 py-2 font-mono text-[11px] text-zinc-100">
          {command || "Выберите терминал и введите пароль — здесь появится команда."}
        </pre>
        <Button
          size="sm"
          variant="outline"
          disabled={!command}
          onClick={() =>
            void copyText(command).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </div>
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
  const [linkTarget, setLinkTarget] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRow | null>(null);
  const [notice, setNotice] = useState<{ title: string; pairing?: string; token?: string } | null>(null);
  const [syncJob, setSyncJob] = useState<{ total: number; index: number; ok: number; fail: number; current: string; done: boolean; error: string } | null>(null);

  const branchesQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "tabel-devices-branches"],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ references?: { branches?: BranchRefRow[] } }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.branches ?? [];
    }
  });
  const branchNames = useMemo(() => activeBranchNamesFromProfile(branchesQ.data ?? []), [branchesQ.data]);
  const branchLookup = useMemo(() => branchLabelLookup(branchesQ.data ?? []), [branchesQ.data]);

  const devicesQ = useQuery({
    queryKey: ["tabel", "devices", tenantSlug],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: { items: DeviceRow[] } }>(`/api/${tenantSlug}/tabel/devices`);
      return data.data.items ?? [];
    },
    refetchInterval: (query) => ((query.state.data ?? []).some((d) => !d.is_linked) ? 4000 : false)
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { pairing_code: string; device_token: string } }>(
        `/api/${tenantSlug}/tabel/devices`,
        {
          name,
          vendor,
          branch: branch.trim() || null,
          serial_no: serialNo.trim() || null
        }
      );
      return data.data;
    },
    onSuccess: async (res) => {
      setName("");
      setNotice({
        title: "Терминал создан. Подключите по коду привязки; ingest URL — только device_token (не pairing).",
        pairing: res.pairing_code,
        token: res.device_token
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

  async function runFaceSync(dev: DeviceRow) {
    if (!dev.terminal_password) {
      setSyncJob({ total: 0, index: 0, ok: 0, fail: 0, current: "", done: true, error: "Пароль терминала ещё не получен. Сначала выполните команду подключения." });
      return;
    }
    setSyncJob({ total: 0, index: 0, ok: 0, fail: 0, current: "Список сотрудников филиала…", done: false, error: "" });
    try {
      const { data } = await api.get<{ data: { terminal_ip: string | null; people: { id: number; name: string; employee_no: string; has_face: boolean }[] } }>(`/api/${tenantSlug}/tabel/devices/${dev.id}/face-sync`);
      const people = (data.data.people ?? []).filter((p) => p.has_face);
      if (people.length === 0) {
        setSyncJob({ total: 0, index: 0, ok: 0, fail: 0, current: "", done: true, error: "В этом филиале нет сотрудников с аватаром. Без фото на терминал никто не отправляется." });
        return;
      }
      const ip = data.data.terminal_ip || dev.terminal_ip;
      if (!ip) {
        setSyncJob({ total: 0, index: 0, ok: 0, fail: 0, current: "", done: true, error: "Адрес терминала неизвестен." });
        return;
      }
      let ok = 0;
      let fail = 0;
      for (let i = 0; i < people.length; i += 1) {
        const person = people[i];
        setSyncJob({ total: people.length, index: i, ok, fail, current: person.name, done: false, error: "" });
        const img = await api.get<{ data: { image_base64: string } }>(`/api/${tenantSlug}/tabel/devices/${dev.id}/face-sync/${person.id}`);
        const face = img.data.data.image_base64;
        if (!face) {
          fail += 1;
          continue;
        }
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch("http://127.0.0.1:39221/push-face", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip, password: dev.terminal_password, employee_no: person.employee_no, name: person.name, face_base64: face })
        });
        window.clearTimeout(timer);
        if (!res.ok) {
          const locked = res.status === 423 || res.status === 401;
          setSyncJob({ total: people.length, index: i, ok, fail: fail + 1, current: person.name, done: true, error: locked ? "Терминал не принял пароль или заблокировал вход. Повторять нельзя — подождите." : "Терминал отклонил запись. Синхронизация остановлена." });
          return;
        }
        ok += 1;
        setSyncJob({ total: people.length, index: i + 1, ok, fail, current: person.name, done: false, error: "" });
      }
      await syncMut.mutateAsync(dev.id);
      setSyncJob({ total: people.length, index: people.length, ok, fail, current: "Готово", done: true, error: "" });
    } catch {
      setSyncJob((cur) => ({ total: cur?.total ?? 0, index: cur?.index ?? 0, ok: cur?.ok ?? 0, fail: cur?.fail ?? 0, current: cur?.current ?? "", done: true, error: "На этом компьютере не запущен локальный агент. Он нужен, потому что терминал в локальной сети." }));
    }
  }

  const confirmMut = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/${tenantSlug}/tabel/devices/${id}/confirm`, {});
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
              {VENDORS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Филиал</label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Не выбран</option>
              {branchNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
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
        {(devicesQ.data ?? []).some((d) => d.pending_confirm) ? (
          <div className="mt-4 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            Есть запрос на подтверждение: {(devicesQ.data ?? []).filter((d) => d.pending_confirm).map((d) => d.name).join(", ")}. Нажмите «Подтвердить» в строке терминала.
          </div>
        ) : null}
        <LinkCommand
          devices={devicesQ.data ?? []}
          linkTarget={linkTarget}
          setLinkTarget={setLinkTarget}
          copied={copiedCmd}
          setCopied={setCopiedCmd}
        />
      </div>

      {(() => {
        const open = (devicesQ.data ?? []).find((d) => d.id === openId);
        if (!open) return null;
        return (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-bold">{open.name}</div>
                <div className="text-xs text-muted-foreground">
                  {vendorLabel(open.vendor)}
                  {open.branch ? ` · ${branchVisibleName(open.branch, branchLookup) ?? ""}` : ""}
                  {open.terminal_ip ? ` · ${open.terminal_ip}` : ""}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>Закрыть</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {open.terminal_password ? <CopyField label="Пароль терминала" value={open.terminal_password} /> : <div className="rounded-md border px-3 py-2 text-xs text-muted-foreground">Пароль появится после команды подключения.</div>}
              <CopyField label="Почта восстановления" value={open.recovery_email || "botirovanvar96@gmail.com"} />
              {open.pairing_code ? <CopyField label="Код привязки" value={open.pairing_code} /> : null}
              {open.serial_no ? <CopyField label="Серийный №" value={open.serial_no} /> : null}
              {open.is_linked && open.device_token ? <CopyField label="X-Device-Token" value={open.device_token} /> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {open.pending_confirm ? (
                <Button size="sm" disabled={!canUpdate || confirmMut.isPending} onClick={() => void confirmMut.mutateAsync(open.id)}>Подтвердить подключение</Button>
              ) : null}
              <span className={`rounded px-2 py-1 text-[11px] font-semibold ${open.is_linked ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {open.pending_confirm ? "Ждёт подтверждения" : open.is_linked ? "Подключён" : "Ожидает"}
              </span>
            </div>
          </div>
        );
      })()}

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
            {(devicesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Терминалов пока нет.
                </td>
              </tr>
            ) : null}
            {(devicesQ.data ?? []).map((dev) => (
              <tr key={dev.id}>
                <td className="px-3 py-2.5 font-semibold">
                  <button type="button" className="text-left hover:underline" onClick={() => setOpenId(dev.id)}>
                    <Cpu className="mr-1.5 inline size-4 text-teal-700" />
                    {dev.name}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  {vendorLabel(dev.vendor)}
                  {dev.branch ? ` · ${branchVisibleName(dev.branch, branchLookup) ?? ""}` : ""}
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
                    {dev.pending_confirm ? "Ждёт подтверждения" : dev.is_linked ? "Подключён" : "Ожидает"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    {dev.pending_confirm ? (
                      <Button size="sm" className="h-7 px-2" disabled={!canUpdate || confirmMut.isPending} onClick={() => void confirmMut.mutateAsync(dev.id)}>
                        Подтвердить
                      </Button>
                    ) : null}
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
                    <Button size="sm" variant="outline" className="h-7 px-2" disabled={(!canAssign && !canUpdate) || (syncJob != null && !syncJob.done)} onClick={() => void runFaceSync(dev)}>
                      {syncJob != null && !syncJob.done ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RefreshCw className="mr-1 size-3" />} Синхр. лица
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-rose-600"
                      disabled={!canUpdate}
                      onClick={() => setDeleteTarget(dev)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={syncJob != null} onOpenChange={(open) => { if (!open) setSyncJob(null); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={syncJob?.done === true}>
          <DialogHeader>
            <DialogTitle>Синхронизация лиц</DialogTitle>
            <DialogDescription>
              {syncJob?.current || "Подготовка…"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-teal-600 transition-all" style={{ width: `${syncJob && syncJob.total > 0 ? Math.round((syncJob.index / syncJob.total) * 100) : syncJob?.done ? 100 : 8}%` }} />
            </div>
            <div className="text-xs text-muted-foreground">
              {syncJob?.total ? `${syncJob.index} из ${syncJob.total}` : "…"} · загружено {syncJob?.ok ?? 0} · ошибок {syncJob?.fail ?? 0}
            </div>
            {syncJob?.error ? <div className="text-sm text-rose-700">{syncJob.error}</div> : null}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteTarget != null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Удалить терминал</DialogTitle>
            <DialogDescription>
              {deleteTarget ? `Терминал «${deleteTarget.name}» будет удалён из списка. Подключение придётся создать заново.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || delMut.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                if (openId === id) setOpenId(null);
                void delMut.mutateAsync(id);
              }}
            >
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
