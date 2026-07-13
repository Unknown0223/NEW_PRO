"use client";

import { HistoryIconButton } from "@/components/history/history-icon-button";
import { SoftVoidConfirmDialog } from "@/components/shared/soft-void-confirm-dialog";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { isSoftVoidUiEnabled } from "@/lib/feature-flags";
import { STALE } from "@/lib/query-stale";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";

export type ClientPhotoRow = {
  id: number;
  image_url?: string;
  caption: string | null;
  order_id: number | null;
  created_at: string;
  content_purged?: boolean;
};

function ClientPhotoThumb({
  tenantSlug,
  clientId,
  photoId,
  alt,
  contentPurged
}: {
  tenantSlug: string;
  clientId: number;
  photoId: number;
  alt: string;
  contentPurged?: boolean;
}) {
  const imgQ = useQuery({
    queryKey: ["client-photo-report-image", tenantSlug, clientId, photoId],
    staleTime: STALE.list,
    enabled: !contentPurged,
    queryFn: async () => {
      const { data } = await api.get<ClientPhotoRow>(
        `/api/${tenantSlug}/clients/${clientId}/photo-reports/${photoId}`
      );
      return data.image_url ?? "";
    }
  });

  if (contentPurged) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-muted px-2 text-center text-[10px] text-muted-foreground">
        Резюме хранится · файл удалён (&gt;2 мес.)
      </div>
    );
  }

  if (imgQ.isLoading) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-muted">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!imgQ.data) {
    return <div className="aspect-square w-full bg-muted" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgQ.data} alt={alt} className="aspect-square w-full object-cover" loading="lazy" />
  );
}

export function ClientProfilePhotoReportsTab({ tenantSlug, clientId }: { tenantSlug: string; clientId: number }) {
  const qc = useQueryClient();
  const softVoidUi = isSoftVoidUiEnabled();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [orderId, setOrderId] = useState("");
  const [voidPhotoId, setVoidPhotoId] = useState<number | null>(null);
  const [archiveView, setArchiveView] = useState(false);

  const listQ = useQuery({
    queryKey: ["client-photo-reports", tenantSlug, clientId, archiveView],
    staleTime: STALE.list,
    queryFn: async () => {
      const qs = archiveView ? "?archive=true" : "";
      const { data } = await api.get<{ data: ClientPhotoRow[] }>(
        `/api/${tenantSlug}/clients/${clientId}/photo-reports${qs}`
      );
      return data.data;
    }
  });

  const addM = useMutation({
    mutationFn: async () => {
      const oid = orderId.trim() ? Number.parseInt(orderId.trim(), 10) : null;
      const { data } = await api.post<ClientPhotoRow>(`/api/${tenantSlug}/clients/${clientId}/photo-reports`, {
        image_url: imageUrl.trim(),
        caption: caption.trim() || null,
        order_id: oid != null && Number.isFinite(oid) && oid > 0 ? oid : null
      });
      return data;
    },
    onSuccess: () => {
      setImageUrl("");
      setCaption("");
      setOrderId("");
      void qc.invalidateQueries({ queryKey: ["client-photo-reports", tenantSlug, clientId] });
    }
  });

  const delM = useMutation({
    mutationFn: async (photoId: number) => {
      await api.delete(`/api/${tenantSlug}/clients/${clientId}/photo-reports/${photoId}`);
    },
    onSuccess: () => {
      setVoidPhotoId(null);
      void qc.invalidateQueries({ queryKey: ["client-photo-reports", tenantSlug, clientId] });
    }
  });

  const restoreM = useMutation({
    mutationFn: async (photoId: number) => {
      await api.post(`/api/${tenantSlug}/clients/${clientId}/photo-reports/${photoId}/restore`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["client-photo-reports", tenantSlug, clientId] });
    }
  });

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Фотоотчёты</p>
        <div className="flex items-center gap-2">
          {softVoidUi ? (
            <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1",
                  !archiveView ? "bg-[#063b36] text-white" : "text-slate-600 hover:bg-muted"
                )}
                onClick={() => setArchiveView(false)}
              >
                Активные
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1",
                  archiveView ? "bg-[#063b36] text-white" : "text-slate-600 hover:bg-muted"
                )}
                onClick={() => setArchiveView(true)}
              >
                Архив
              </button>
            </div>
          ) : null}
          <HistoryIconButton
            module="clients"
            section="clients"
            entityType="client"
            entityId={clientId}
            title="История клиента"
            size="icon-sm"
            variant="outline"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Файлы изображений хранятся ~2 месяца. После этого остаётся только запись (для подсчёта), сам файл
        удаляется.
      </p>

      {!archiveView ? (
        <Card className="border border-border/90 shadow-panel">
          <CardContent className="space-y-3 p-3 sm:p-4">
            <p className="text-xs text-muted-foreground">
              Добавьте ссылку на изображение (CDN, облако или публичный URL).
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">URL изображения *</Label>
                <Input
                  className="h-9"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Подпись</Label>
                <Input className="h-9" value={caption} onChange={(e) => setCaption(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ID заказа (необязательно)</Label>
                <Input
                  className="h-9"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5 bg-teal-600 text-white hover:bg-teal-700")}
              disabled={!imageUrl.trim() || addM.isPending}
              onClick={() => void addM.mutateAsync()}
            >
              <ImagePlus className="h-4 w-4" />
              Добавить в фотографии
            </button>
            {addM.isError ? (
              <p className="text-xs text-destructive">Не удалось сохранить (проверьте URL и заказ).</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{archiveView ? "Архив пуст." : "Пока нет фото."}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <li key={r.id} className="group relative overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <ClientPhotoThumb
                tenantSlug={tenantSlug}
                clientId={clientId}
                photoId={r.id}
                alt={r.caption ?? ""}
                contentPurged={r.content_purged}
              />
              <div className="space-y-1 p-2">
                {r.caption ? <p className="line-clamp-2 text-xs text-foreground">{r.caption}</p> : null}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                  {r.order_id != null ? ` · заказ #${r.order_id}` : ""}
                </p>
                {archiveView ? (
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 w-full text-xs")}
                    disabled={restoreM.isPending}
                    onClick={() => void restoreM.mutateAsync(r.id)}
                  >
                    <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
                    Восстановить
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-8 w-full text-xs text-destructive"
                    )}
                    disabled={delM.isPending}
                    onClick={() => setVoidPhotoId(r.id)}
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                    В архив
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SoftVoidConfirmDialog
        open={voidPhotoId != null}
        onClose={() => {
          if (delM.isPending) return;
          setVoidPhotoId(null);
        }}
        onConfirm={async () => {
          if (voidPhotoId != null) await delM.mutateAsync(voidPhotoId);
        }}
        title="Архивировать фотоотчёт"
        description="Фотоотчёт будет скрыт и может быть восстановлен из вкладки «Архив»."
        reasonRequired={false}
        reasonPlaceholder="Комментарий (необязательно)"
        confirmLabel="В архив"
        pending={delM.isPending}
      />
    </div>
  );
}
