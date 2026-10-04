"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";
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
  is_outdated?: boolean;
};

type ApkStatus = {
  ready: boolean;
  bytes: number | null;
  mtime_ms: number | null;
  download_url: string;
};

type MobileAppReleaseResponse = {
  policy: MobileAppReleasePolicy;
  users?: OutdatedUser[];
  users_count?: number;
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
  const { has, hasAny } = usePermissions();
  const canView = hasAny("settings.mobile_app.view", "settings.mobile_app.update");
  const canEdit = has("settings.mobile_app.update");
  const canUpload = has("settings.mobile_app.import");
  const canNotify = has("settings.mobile_app.transfer");
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

  const { data, isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["settings", "mobile-app-release", tenantSlug],
    enabled: Boolean(tenantSlug) && canView,
    staleTime: 0,
    gcTime: STALE.live,
    refetchInterval: 12_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: body } = await api.get<MobileAppReleaseResponse>(
        `/api/${tenantSlug}/settings/mobile-app-release`,
        { headers: { "Cache-Control": "no-cache" } }
      );
      return body;
    }
  });

  const mobileUsers = Array.isArray(data?.users)
    ? data.users
    : (data?.outdated_users ?? []).map((u) => ({ ...u, is_outdated: true }));
  const outdatedCount = data?.outdated_count ?? mobileUsers.filter((u) => u.is_outdated).length;

  const policyKey = data?.policy
    ? [
        data.policy.min_version,
        data.policy.latest_version,
        data.policy.force_update,
        data.policy.download_url,
        data.policy.store_url_android,
        data.policy.store_url_ios,
        data.policy.release_notes,
        data.apk?.download_url
      ].join("|")
    : "";

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
    // Faqat siyosat o‘zgaganda forma yangilanadi — poll hodimlar jadvalini buzmasin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policyKey]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (forceUpdate) {
        const ok = await confirm({
          title: "Принудительное обновление",
          message: "Агенты со старой версией не смогут войти — обновление приложения станет обязательным.",
          detail:
            "Если APK нет на сервере, обновление завершится ошибкой 404. Удалять приложение не нужно — при совпадении ключа подписи оно обновится изнутри. Продолжить?",
          confirmLabel: "Да",
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
          ? "Сохранено — старые версии не смогут войти без обновления"
          : "Сохранено — необязательное обновление: «Обновить» или «Позже», удалять приложение не нужно"
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
        setReleaseNotes(`Обновление ${body.policy.latest_version}`);
      }
      setMsgTone("ok");
      setMsg(
        `APK готов (${formatMb(body.bytes)}). Версия ${body.policy.latest_version ?? "—"}. ` +
          "Принудительное обновление не включено — агенты обновят приложение изнутри кнопкой «Обновить», без удаления."
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
          ? `Push-уведомление отправлено: токенов — ${r.tokens_sent}, пользователей — ${r.users}`
          : `FCM не настроен — при открытии приложения агенты всё равно увидят окно обновления (пользователей: ${r.users})`
      );
    },
    onError: (e) => {
      setMsgTone("err");
      setMsg(getUserFacingError(e));
    }
  });

  if (!hydrated) return null;
  if (!canView) {
    return <p className="text-sm text-muted-foreground">Нет доступа к настройкам мобильного приложения.</p>;
  }

  const apkReady = data?.apk?.ready === true;
  const latest = data?.policy.latest_version ?? latestVersion;
  const otaActive = Boolean(latest && (downloadUrl || apkReady));
  const statusOk = otaActive && apkReady;
  const effectiveUrl = downloadUrl || data?.apk?.download_url || "";

  return (
    <div className="w-full space-y-6 pb-10">
      <PageHeader
        title="Мобильное приложение — обновление с сервера"
        description="Загрузите новый APK на сервер. Агенты получат обновление внутри приложения при его открытии — удалять не нужно (при совпадении ключа подписи PIN и кеш сохраняются). Включайте «Принудительное обновление» только когда APK готов."
      />

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка…
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
                    Статус
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Текущее состояние OTA-обновления (по воздуху) — кратко
                  </CardDescription>
                </div>
                <Badge variant={statusOk ? "success" : apkReady ? "warning" : "destructive"} className="px-2.5 py-1 text-[11px]">
                  {statusOk ? "OTA готово" : apkReady ? "APK есть" : "APK нет"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="Последняя версия"
                  value={latest || "—"}
                  hint="Предлагается агентам"
                  tone={latest ? "ok" : "warn"}
                />
                <StatTile
                  label="Минимальная версия"
                  value={minVersion || data?.policy.min_version || "—"}
                  hint="Ниже — блокировка"
                  tone="default"
                />
                <StatTile
                  label="Файл APK"
                  value={apkReady ? formatMb(data?.apk?.bytes) : "Нет"}
                  hint={apkReady ? `Загружен: ${formatWhen(data?.apk?.mtime_ms)}` : "Сначала загрузите APK"}
                  tone={apkReady ? "ok" : "bad"}
                />
                <StatTile
                  label="Устаревшие агенты"
                  value={`${outdatedCount}`}
                  hint={forceUpdate ? "Принудительное обновление включено" : "Принудительное обновление выключено"}
                  tone={outdatedCount > 0 ? "warn" : "ok"}
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
                      ? `Обновление внутри приложения работает — ${latest} (удалять не нужно)`
                      : apkReady
                        ? "APK есть. Достаточно сохранить и показать необязательное окно; принудительный флаг блокирует вход"
                        : "APK нет на сервере — «Обновить» вернёт 404. Сначала загрузите APK и не включайте принудительное обновление"}
                  </p>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground/80">URL загрузки:</span>{" "}
                      <span className="break-all font-mono">{effectiveUrl || "—"}</span>
                    </p>
                    <p>
                      <span className="font-medium text-foreground/80">Принудительно:</span>{" "}
                      {forceUpdate
                        ? "да — старая версия блокирует вход (без APK агент застрянет)"
                        : "нет — необязательно «Обновить» / «Позже», приложение не удаляется"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* APK yuklash */}
          <Card className={cn("hover:shadow-sm", !canUpload && "hidden")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-4 w-4 text-muted-foreground" />
                Загрузка APK
              </CardTitle>
              <CardDescription>
                Выберите релизный APK. После загрузки URL и версия заполнятся автоматически.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="download_url">URL APK на сервере</Label>
                <Input
                  id="download_url"
                  placeholder="https://backend.../api/mobile/apk-download?slug=..."
                  value={downloadUrl}
                  onChange={(e) => setDownloadUrl(e.target.value)}
                  className="font-mono text-xs sm:text-sm"
                />
                <FieldHint>
                  Обычно сервер подставляет его сам. Менять вручную не нужно — достаточно загрузить APK.
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
                      Загрузка…
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Загрузить новый APK на сервер
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
                    Проверить скачивание
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
                        Загрузка…{" "}
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
                  Агент нажимает «Обновить» — APK устанавливается внутри приложения. После повторного развёртывания
                  сервера APK может потребоваться загрузить заново.
                </FieldHint>
              )}
            </CardContent>
          </Card>

          {/* Versiya siyosati */}
          <Card className="hover:shadow-sm">
            <CardHeader>
              <CardTitle>Политика версий</CardTitle>
              <CardDescription>
                Минимальная — всё, что ниже, блокируется. Последняя — показывается в окне обновления.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <fieldset disabled={!canEdit} className="contents">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min_version">Минимальная версия</Label>
                  <Input
                    id="min_version"
                    placeholder="например: 3.1.0"
                    value={minVersion}
                    onChange={(e) => setMinVersion(e.target.value)}
                  />
                  <FieldHint>APK ниже этой версии — принудительное обновление / ограничение входа.</FieldHint>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="latest_version">Последняя версия (новое приложение)</Label>
                  <Input
                    id="latest_version"
                    placeholder="например: 3.1.20"
                    value={latestVersion}
                    onChange={(e) => setLatestVersion(e.target.value)}
                  />
                  <FieldHint>Текущий номер релиза на сервере (например, 3.1.20).</FieldHint>
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
                    <span className="text-sm font-medium">Принудительное обновление</span>
                    <Badge variant={forceUpdate ? "success" : "secondary"}>
                      {forceUpdate ? "Включено" : "Выключено"}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Если включено: APK ниже последней версии не пускает в систему. Если APK нет на сервере, агент
                    застрянет. Если выключено (рекомендуется): «Обновить» / «Позже» — удалять приложение
                    не нужно, при совпадении ключа PIN сохраняется.
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label htmlFor="release_notes">Примечания к релизу</Label>
                <textarea
                  id="release_notes"
                  rows={3}
                  className="flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Короткий текст, который увидят агенты…"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                />
                <FieldHint>Показывается в окне обновления приложения.</FieldHint>
              </div>
              </fieldset>
            </CardContent>
          </Card>

          {/* Do‘kon havolalari */}
          <Card className="hover:shadow-sm">
            <CardHeader>
              <CardTitle>Ссылки на магазины</CardTitle>
              <CardDescription>Необязательно. Пока в основном используется серверное OTA-обновление.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store_android">Google Play</Label>
                  <Input
                    id="store_android"
                    placeholder="Оставьте пустым — серверное OTA"
                    disabled={!canEdit}
                    value={storeAndroid}
                    onChange={(e) => setStoreAndroid(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store_ios">App Store</Label>
                  <Input
                    id="store_ios"
                    placeholder="Для iOS — позже"
                    disabled={!canEdit}
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
              <Button
                className={cn(!canEdit && "hidden")}
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Сохранить
              </Button>
              <Button
                variant="outline"
                className={cn(!canNotify && "hidden")}
                onClick={() => notifyMut.mutate()}
                disabled={notifyMut.isPending || outdatedCount === 0}
              >
                {notifyMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Напомнить устаревшим
                <Badge variant="secondary" className="ml-2">
                  {outdatedCount}
                </Badge>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                title="Обновить сейчас"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
                Обновить
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

          {/* Hodimlar APK holati */}
          <Card className="overflow-hidden hover:shadow-sm">
            <CardHeader className="bg-muted/15">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Сотрудники — версия приложения
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Обновляется автоматически каждые ~12 секунд. «Версия неизвестна» — сотрудник ещё не входил и не
                    синхронизировался.
                    {dataUpdatedAt > 0 ? (
                      <>
                        {" "}
                        Последнее обновление:{" "}
                        <span className="font-medium text-foreground/80">
                          {formatSync(new Date(dataUpdatedAt).toISOString())}
                        </span>
                        {isFetching ? " · обновление…" : null}
                      </>
                    ) : null}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Всего: {mobileUsers.length}</Badge>
                  <Badge variant={outdatedCount > 0 ? "warning" : "success"}>
                    устаревших: {outdatedCount}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Имя / логин</th>
                      <th className="px-4 py-2.5 font-medium">Роль</th>
                      <th className="px-4 py-2.5 font-medium">Версия APK</th>
                      <th className="px-4 py-2.5 font-medium">Статус</th>
                      <th className="px-4 py-2.5 font-medium">Устройство</th>
                      <th className="px-4 py-2.5 font-medium">Последняя синхронизация</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mobileUsers.map((u) => {
                      const outdated = u.is_outdated === true;
                      return (
                        <tr
                          key={u.id}
                          className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                        >
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
                              <Badge variant="warning">неизвестна</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {outdated ? (
                              <Badge variant="warning">нужно обновить</Badge>
                            ) : (
                              <Badge variant="success">актуальная</Badge>
                            )}
                          </td>
                          <td className="max-w-[10rem] truncate px-4 py-2.5 text-muted-foreground">
                            {u.device_name ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                            {formatSync(u.last_sync_at)}
                          </td>
                        </tr>
                      );
                    })}
                    {mobileUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/80" />
                          Сотрудники с доступом к мобильному приложению не найдены
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
