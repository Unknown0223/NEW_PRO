"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { useAppConfirm } from "@/components/ui/app-confirm-dialog";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileUp,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
  Users
} from "lucide-react";
import { type AxiosProgressEvent } from "axios";

type MobileAppReleasePolicy = {
  min_version: string | null;
  latest_version: string | null;
  force_update: boolean;
  download_url: string | null;
  store_url_android: string | null;
  store_url_ios: string | null;
  release_notes: string | null;
};

type OutdatedUser = {
  id: number;
  name: string;
  login: string;
  role: string;
  apk_version: string | null;
  device_name: string | null;
  last_sync_at: string | null;
};

type ApkStatus = {
  ready: boolean;
  bytes: number | null;
  mtime_ms: number | null;
  download_url: string;
};

type MobileAppReleaseResponse = {
  policy: MobileAppReleasePolicy;
  outdated_count: number;
  outdated_users: OutdatedUser[];
  apk?: ApkStatus;
};

function formatMb(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return "—";
  try {
    return new Date(ms).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function formatSync(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function StatTile({
  label,
  value,
  hint,
  tone = "default"
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "ok"
      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/[0.06]"
        : tone === "bad"
          ? "border-destructive/25 bg-destructive/5"
          : "border-border/70 bg-muted/20";

  return (
    <div className={cn("rounded-lg border px-3.5 py-3", toneClass)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 text-base font-semibold tracking-tight text-foreground">{value}</div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export default function MobileAppSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();
  const { confirm, dialog: confirmDialog } = useAppConfirm();

  const [minVersion, setMinVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [storeAndroid, setStoreAndroid] = useState("");
  const [storeIos, setStoreIos] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "mobile-app-release", tenantSlug],
    enabled: Boolean(tenantSlug) && isAdmin,
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data: body } = await api.get<MobileAppReleaseResponse>(
        `/api/${tenantSlug}/settings/mobile-app-release`
      );
      return body;
    }
  });

  useEffect(() => {
    if (!data?.policy) return;
    const p = data.policy;
    setMinVersion(p.min_version ?? "");
    setLatestVersion(p.latest_version ?? "");
    setForceUpdate(p.force_update);
    setDownloadUrl(p.download_url ?? data.apk?.download_url ?? "");
    setStoreAndroid(p.store_url_android ?? "");
    setStoreIos(p.store_url_ios ?? "");
    setReleaseNotes(p.release_notes ?? "");
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (forceUpdate) {
        const ok = await confirm({
          title: "Majburiy yangilash",
          message: "Eski versiyadagi agentlar login qila olmaydi, ilovani yangilash majburiy bo‘ladi.",
          detail:
            "APK serverda bo‘lmasa yangilash 404 bilan yopiladi. O‘chirish shart emas — kalit mos bo‘lsa ilova ichida yangilanadi. Davom etasizmi?",
          confirmLabel: "Ha",
          cancelLabel: "Нет",
          destructive: false
        });
        if (!ok) throw new Error("SAVE_CANCELLED");
      }
      const { data: body } = await api.patch<{ policy: MobileAppReleasePolicy }>(
        `/api/${tenantSlug}/settings/mobile-app-release`,
        {
          min_version: minVersion.trim() || null,
          latest_version: latestVersion.trim() || null,
          force_update: forceUpdate,
          download_url: downloadUrl.trim() || null,
          store_url_android: storeAndroid.trim() || null,
          store_url_ios: storeIos.trim() || null,
          release_notes: releaseNotes.trim() || null
        }
      );
      return body.policy;
    },
    onSuccess: () => {
      setMsgTone("ok");
      setMsg(
        forceUpdate
          ? "Saqlandi — past versiyalar loginni yangilashsiz ocholmaydi"
          : "Saqlandi — ixtiyoriy yangilash: «Обновить» yoki «Позже», o‘chirish shart emas"
      );
      void qc.invalidateQueries({ queryKey: ["settings", "mobile-app-release", tenantSlug] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "SAVE_CANCELLED") return;
      setMsgTone("err");
      setMsg(getUserFacingError(e));
    }
  });

  async function uploadApk(file: File) {
    if (!tenantSlug) return;
    setUploading(true);
    setUploadProgress(0);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data: body } = await api.post<{
        download_url: string;
        bytes: number;
        policy: MobileAppReleasePolicy;
      }>(`/api/${tenantSlug}/settings/mobile-app-release/upload`, fd, {
        onUploadProgress: (evt: AxiosProgressEvent) => {
          const loaded = evt.loaded ?? 0;
          const total = evt.total ?? file.size;
          const pct = total > 0 ? (loaded / total) * 100 : 0;
          setUploadProgress(Math.min(99, pct));
        }
      });
      setUploadProgress(100);
      setDownloadUrl(body.download_url);
      setForceUpdate(body.policy.force_update === true);
      if (body.policy.latest_version) {
        setLatestVersion(body.policy.latest_version);
      }
      if (body.policy.min_version) {
        setMinVersion(body.policy.min_version);
      } else {
        setMinVersion("");
      }
      if (body.policy.release_notes) {
        setReleaseNotes(body.policy.release_notes);
      } else if (body.policy.latest_version) {
        setReleaseNotes(`Production yangilash ${body.policy.latest_version}`);
      }
      setMsgTone("ok");
      setMsg(
        `APK tayyor (${formatMb(body.bytes)}). Versiya ${body.policy.latest_version ?? "—"}. ` +
          "Majburiy yangilash yoqilmadi — agentlar ilovani o‘chirmasdan, ichida «Обновить» bilan yangilaydi."
      );
      void qc.invalidateQueries({ queryKey: ["settings", "mobile-app-release", tenantSlug] });
    } catch (e) {
      setMsgTone("err");
      setMsg(getUserFacingError(e));
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(null), 800);
    }
  }

  const notifyMut = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.post<{
        users: number;
        tokens_sent: number;
        fcm_configured: boolean;
      }>(`/api/${tenantSlug}/settings/mobile-app-release/notify`, {});
      return body;
    },
    onSuccess: (r) => {
      setMsgTone("ok");
      setMsg(
        r.fcm_configured
          ? `Push yuborildi: ${r.tokens_sent} token (${r.users} foydalanuvchi)`
          : `FCM sozlanmagan — agentlar ilovani ochganda baribir yangilash dialogi chiqadi (${r.users} ta)`
      );
    },
    onError: (e) => {
      setMsgTone("err");
      setMsg(getUserFacingError(e));
    }
  });

  if (!hydrated) return null;
  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Faqat administrator uchun.</p>;
  }

  const apkReady = data?.apk?.ready === true;
  const latest = data?.policy.latest_version ?? latestVersion;
  const otaActive = Boolean(latest && (downloadUrl || apkReady));
  const statusOk = otaActive && apkReady;
  const effectiveUrl = downloadUrl || data?.apk?.download_url || "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="Mobil ilova — serverdan yangilash"
        description="Yangi APK ni serverga yuklang. Agentlar ilovani ochganda ichida yangilanadi — o‘chirish shart emas (imzo kaliti mos bo‘lsa PIN/kesh saqlanadi). «Majburiy yangilash» ni faqat APK tayyor bo‘lganda yoqing."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yuklanmoqda…
        </div>
      ) : (
        <>
          {/* Holat */}
          <Card className="overflow-hidden hover:shadow-sm">
            <CardHeader className="bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    Holat
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Hozirgi OTA (over-the-air) yangilash holati — bir qarashda
                  </CardDescription>
                </div>
                <Badge variant={statusOk ? "success" : apkReady ? "warning" : "destructive"} className="px-2.5 py-1 text-[11px]">
                  {statusOk ? "OTA tayyor" : apkReady ? "APK bor" : "APK yo‘q"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Oxirgi versiya"
                  value={latest || "—"}
                  hint="Agentlarga taklif qilinadigan"
                  tone={latest ? "ok" : "warn"}
                />
                <StatTile
                  label="Minimal versiya"
                  value={minVersion || data?.policy.min_version || "—"}
                  hint="Bundan past — blok"
                  tone="default"
                />
                <StatTile
                  label="APK fayli"
                  value={apkReady ? formatMb(data?.apk?.bytes) : "Yo‘q"}
                  hint={apkReady ? `Yuklangan: ${formatWhen(data?.apk?.mtime_ms)}` : "Avval APK yuklang"}
                  tone={apkReady ? "ok" : "bad"}
                />
                <StatTile
                  label="Eskirgan agentlar"
                  value={`${data?.outdated_count ?? 0} ta`}
                  hint={forceUpdate ? "Majburiy yangilash yoqilgan" : "Majburiy yangilash o‘chirilgan"}
                  tone={(data?.outdated_count ?? 0) > 0 ? "warn" : "ok"}
                />
              </div>

              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-sm",
                  statusOk
                    ? "border-emerald-500/30 bg-emerald-500/[0.07]"
                    : "border-amber-500/30 bg-amber-500/[0.07]"
                )}
              >
                {statusOk ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">
                    {statusOk
                      ? `Ilova ichida yangilash ishlaydi — ${latest} (o‘chirish shart emas)`
                      : apkReady
                        ? "APK bor. Saqlash + ixtiyoriy dialog yetarli; majburiy belgi loginni bloklaydi"
                        : "APK serverda yo‘q — «Обновить» 404 beradi. Avval APK yuklang, majburiyni yoqmang"}
                  </p>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground/80">Yuklash URL:</span>{" "}
                      <span className="break-all font-mono">{effectiveUrl || "—"}</span>
                    </p>
                    <p>
                      <span className="font-medium text-foreground/80">Majburiy:</span>{" "}
                      {forceUpdate
                        ? "ha — past versiya loginni bloklaydi (APK bo‘lmasa tuzoq)"
                        : "yo‘q — ixtiyoriy «Обновить» / «Позже», ilova o‘chirilmaydi"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* APK yuklash */}
          <Card className="hover:shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                APK yuklash
              </CardTitle>
              <CardDescription>
                Release APK ni tanlang. Yuklangach URL va versiya avtomatik to‘ldiriladi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="download_url">Server APK URL</Label>
                <Input
                  id="download_url"
                  placeholder="https://backend.../api/mobile/apk-download?slug=..."
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  className="font-mono text-xs sm:text-sm"
                />
                <FieldHint>
                  Odatda server o‘zi beradi. Qo‘lda o‘zgartirish shart emas — APK yuklash kifoya.
                </FieldHint>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="apk_upload"
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadApk(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={() => document.getElementById("apk_upload")?.click()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Yuklanmoqda…
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Yangi APK ni serverga yuklash
                    </>
                  )}
                </Button>
                {effectiveUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.open(effectiveUrl, "_blank", "noopener,noreferrer")}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Yuklab olishni sinash
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-60" />
                  </Button>
                ) : null}
              </div>

              {uploading || uploadProgress != null ? (
                <div className="rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium">
                        Yuklanmoqda…{" "}
                        {uploadProgress != null ? `${Math.round(uploadProgress)}%` : ""}
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                          style={{ width: `${uploadProgress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <FieldHint>
                  Agent «Обновить» bosadi — APK ilova ichida o‘rnatiladi. Redeploydan keyin APK ni qayta
                  yuklash kerak bo‘lishi mumkin.
                </FieldHint>
              )}
            </CardContent>
          </Card>

          {/* Versiya siyosati */}
          <Card className="hover:shadow-sm">
            <CardHeader>
              <CardTitle>Versiya siyosati</CardTitle>
              <CardDescription>
                Minimal — undan past bloklanadi. Oxirgi — yangilash dialogida ko‘rsatiladi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min_version">Minimal versiya</Label>
                  <Input
                    id="min_version"
                    placeholder="masalan: 3.1.0"
                    value={minVersion}
                    onChange={(e) => setMinVersion(e.target.value)}
                  />
                  <FieldHint>Bundan past APK — majburiy yangilash / kirish cheklovi.</FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latest_version">Oxirgi versiya (yangi ilova)</Label>
                  <Input
                    id="latest_version"
                    placeholder="masalan: 3.1.20"
                    value={latestVersion}
                    onChange={(e) => setLatestVersion(e.target.value)}
                  />
                  <FieldHint>Serverdagi joriy release raqami (masalan 3.1.20).</FieldHint>
                </div>
              </div>

              <label
                htmlFor="force_update"
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                  forceUpdate
                    ? "border-emerald-500/30 bg-emerald-500/[0.06]"
                    : "border-border/70 bg-muted/15 hover:bg-muted/25"
                )}
              >
                <input
                  id="force_update"
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={forceUpdate}
                  onChange={(e) => setForceUpdate(e.target.checked)}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Majburiy yangilash</span>
                    <Badge variant={forceUpdate ? "success" : "secondary"}>
                      {forceUpdate ? "Yoqilgan" : "O‘chirilgan"}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Yoqilsa: oxirgi versiyadan past APK loginni ochmaydi. APK serverda bo‘lmasa agent
                    tuzoqda qoladi. O‘chirilsa (tavsiya): «Обновить» / «Позже» — ilovani o‘chirish
                    shart emas, kalit mos bo‘lsa PIN saqlanadi.
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label htmlFor="release_notes">Reliz eslatmalari</Label>
                <textarea
                  id="release_notes"
                  rows={3}
                  className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Agentlarga ko‘rinadigan qisqa matn…"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                />
                <FieldHint>Ilova yangilash oynasida ko‘rsatiladi.</FieldHint>
              </div>
            </CardContent>
          </Card>

          {/* Do‘kon havolalari */}
          <Card className="hover:shadow-sm">
            <CardHeader>
              <CardTitle>Do‘kon havolalari</CardTitle>
              <CardDescription>Ixtiyoriy. Hozircha asosan server OTA ishlatiladi.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store_android">Google Play</Label>
                  <Input
                    id="store_android"
                    placeholder="Bo‘sh qoldiring — server OTA"
                    value={storeAndroid}
                    onChange={(e) => setStoreAndroid(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store_ios">App Store</Label>
                  <Input
                    id="store_ios"
                    placeholder="iOS uchun keyinroq"
                    value={storeIos}
                    onChange={(e) => setStoreIos(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amallar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Saqlash
              </Button>
              <Button
                variant="outline"
                onClick={() => notifyMut.mutate()}
                disabled={notifyMut.isPending || (data?.outdated_count ?? 0) === 0}
              >
                {notifyMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Eskirganlarga eslatma
                <Badge variant="secondary" className="ml-2">
                  {data?.outdated_count ?? 0}
                </Badge>
              </Button>
            </div>
            {msg ? (
              <p
                className={cn(
                  "max-w-xl text-sm",
                  msgTone === "ok" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                )}
              >
                {msg}
              </p>
            ) : null}
          </div>

          {/* Eskirganlar jadvali */}
          <Card className="overflow-hidden hover:shadow-sm">
            <CardHeader className="bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Yangilanishi kerak
                  </CardTitle>
                  <CardDescription className="mt-1">
                    «Versiya noma’lum» — hali yangi ilova bilan login/sync qilmagan. Ilovani ochganda
                    majburiy yangilash chiqadi.
                  </CardDescription>
                </div>
                <Badge variant={(data?.outdated_users.length ?? 0) > 0 ? "warning" : "success"}>
                  {data?.outdated_users.length ?? 0} ta
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Ism / login</th>
                      <th className="px-4 py-2.5 font-medium">Rol</th>
                      <th className="px-4 py-2.5 font-medium">APK versiya</th>
                      <th className="px-4 py-2.5 font-medium">Qurilma</th>
                      <th className="px-4 py-2.5 font-medium">Oxirgi sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.outdated_users ?? []).map((u) => (
                      <tr key={u.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.login}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="font-normal capitalize">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {u.apk_version ? (
                            <span className="font-mono text-xs font-medium">{u.apk_version}</span>
                          ) : (
                            <Badge variant="warning">noma’lum</Badge>
                          )}
                        </td>
                        <td className="max-w-[10rem] truncate px-4 py-2.5 text-muted-foreground">
                          {u.device_name ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                          {formatSync(u.last_sync_at)}
                        </td>
                      </tr>
                    ))}
                    {(data?.outdated_users.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/80" />
                          Barcha foydalanuvchilar {latest || "oxirgi"} versiyada (yoki hali sync
                          qilmaganlar yo‘q)
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
