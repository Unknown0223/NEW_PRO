"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore, useAuthStoreHydrated, useEffectiveRole } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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

type MobileAppReleaseResponse = {
  policy: MobileAppReleasePolicy;
  outdated_count: number;
  outdated_users: OutdatedUser[];
};

export default function MobileAppSettingsPage() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const role = useEffectiveRole();
  const isAdmin = role === "admin";
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();

  const [minVersion, setMinVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [forceUpdate, setForceUpdate] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [storeAndroid, setStoreAndroid] = useState("");
  const [storeIos, setStoreIos] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
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
    setDownloadUrl(p.download_url ?? "");
    setStoreAndroid(p.store_url_android ?? "");
    setStoreIos(p.store_url_ios ?? "");
    setReleaseNotes(p.release_notes ?? "");
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
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
      setMsg("Saqlandi");
      void qc.invalidateQueries({ queryKey: ["settings", "mobile-app-release", tenantSlug] });
    },
    onError: (e) => setMsg(getUserFacingError(e))
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
      if (body.policy.latest_version) {
        setLatestVersion(body.policy.latest_version ?? "");
      }
      setMsg(
        `APK yuklandi (${Math.round(body.bytes / (1024 * 1024))} MB).` +
          (body.policy.latest_version
            ? ` Oxirgi versiya: ${body.policy.latest_version} — Saqlash ni bosing.`
            : " Oxirgi versiyani qo'lda kiriting va Saqlash ni bosing.")
      );
      void qc.invalidateQueries({ queryKey: ["settings", "mobile-app-release", tenantSlug] });
    } catch (e) {
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
      setMsg(
        r.fcm_configured
          ? `Push yuborildi: ${r.tokens_sent} token (${r.users} foydalanuvchi)`
          : `FCM sozlanmagan — ${r.users} eskirgan foydalanuvchi`
      );
    },
    onError: (e) => setMsg(getUserFacingError(e))
  });

  if (!hydrated) return null;
  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Faqat administrator uchun.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Mobil ilova — versiya siyosati</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Serverdan avtomatik yangilash: APK yuklang, versiya siyosatini sozlang. Foydalanuvchi ma&apos;lumotlari saqlanadi.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min_version">Minimal versiya</Label>
              <Input
                id="min_version"
                placeholder="3.0.0"
                value={minVersion}
                onChange={(e) => setMinVersion(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="latest_version">Oxirgi versiya</Label>
              <Input
                id="latest_version"
                placeholder="3.1.0"
                value={latestVersion}
                onChange={(e) => setLatestVersion(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forceUpdate}
              onChange={(e) => setForceUpdate(e.target.checked)}
            />
            Majburiy yangilash (oxirgi versiyadan past bo‘lsa bloklash)
          </label>

          <div className="space-y-2">
            <Label htmlFor="download_url">APK yuklab olish URL</Label>
            <Input
              id="download_url"
              placeholder="https://backend.../api/mobile/apk-download?slug=..."
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => document.getElementById("apk_upload")?.click()}
              >
                {uploading ? "Yuklanmoqda…" : "APK ni serverga yuklash"}
              </Button>
            </div>
            {uploading || uploadProgress != null ? (
              <div className="mt-2 rounded-lg border border-border/80 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-medium">
                      Yuklanmoqda…{" "}
                      {uploadProgress != null ? `${Math.round(uploadProgress)}%` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ilova ichida yuklab o&apos;rnatiladi — kesh va buyurtmalar saqlanadi
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
              <p className="text-xs text-muted-foreground">
                Ilova ichida yuklab o&apos;rnatiladi — kesh va buyurtmalar saqlanadi
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store_android">Google Play havolasi</Label>
              <Input
                id="store_android"
                placeholder="https://play.google.com/..."
                value={storeAndroid}
                onChange={(e) => setStoreAndroid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store_ios">App Store havolasi</Label>
              <Input
                id="store_ios"
                placeholder="https://apps.apple.com/..."
                value={storeIos}
                onChange={(e) => setStoreIos(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="release_notes">Reliz eslatmalari</Label>
            <textarea
              id="release_notes"
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              Saqlash
            </Button>
            <Button
              variant="outline"
              onClick={() => notifyMut.mutate()}
              disabled={notifyMut.isPending || (data?.outdated_count ?? 0) === 0}
            >
              Eskirganlarga push yuborish ({data?.outdated_count ?? 0})
            </Button>
          </div>

          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

          <div className="rounded-lg border">
            <div className="border-b px-4 py-2 text-sm font-medium">
              Eskirgan mobil foydalanuvchilar ({data?.outdated_users.length ?? 0})
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2">Ism</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Versiya APK</th>
                    <th className="px-3 py-2">Qurilma</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.outdated_users ?? []).map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{u.name}</td>
                      <td className="px-3 py-2">{u.role}</td>
                      <td className="px-3 py-2">{u.apk_version ?? "—"}</td>
                      <td className="px-3 py-2">{u.device_name ?? "—"}</td>
                    </tr>
                  ))}
                  {(data?.outdated_users.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                        Barcha foydalanuvchilar siyosatga mos
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
