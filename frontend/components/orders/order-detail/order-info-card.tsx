"use client";

import type { OrderDetailRow } from "@/components/orders/order-detail-view";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Copy,
  ExternalLink,
  Gift,
  MapPin,
  MessageSquare,
  Package,
  Percent,
  Tag,
  ToggleLeft,
  Truck,
  User
} from "lucide-react";
import { formatOrderDetailDateOnly, formatOrderDetailDateTime } from "./format-datetime";
import { InfoRow, InfoValueBox, OrderDetailCard } from "./info-row";

function formatAgentLabel(data: OrderDetailRow): string {
  const code = data.agent_code?.trim();
  const name = data.agent_name?.trim();
  if (code && name) return `${code} [${name}]`;
  if (code) return code;
  if (name) return name;
  return data.agent_display?.trim() || "—";
}

export function OrderInfoCard({
  data,
  requestTypeLabel,
  canOperate,
  commentDraft,
  onCommentChange,
  onCommentSave,
  commentSaving,
  commentSaveError
}: {
  data: OrderDetailRow;
  requestTypeLabel?: string | null;
  canOperate: boolean;
  commentDraft: string;
  onCommentChange: (v: string) => void;
  onCommentSave: () => void;
  commentSaving: boolean;
  commentSaveError: string | null;
}) {
  const gpsText =
    data.client_gps_text?.trim() ||
    (data.client_latitude != null && data.client_longitude != null
      ? `${data.client_latitude}, ${data.client_longitude}`
      : null);
  const mapHref = gpsText
    ? `https://maps.google.com/?q=${encodeURIComponent(gpsText)}`
    : null;

  const savedComment = (data.comment ?? "").trim();
  const draftTrimmed = commentDraft.trim();
  const commentDirty = draftTrimmed !== savedComment;
  const showCommentSave =
    canOperate && data.status !== "cancelled" && commentDirty && draftTrimmed.length > 0;

  return (
    <OrderDetailCard title="Информация о заявке">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4">
        <InfoRow icon={User} label="Агент">
          <InfoValueBox align="start">
            <span className="font-medium">{formatAgentLabel(data)}</span>
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Calendar} label="Дата создания">
          <InfoValueBox>{formatOrderDetailDateTime(data.created_at)}</InfoValueBox>
        </InfoRow>

        <InfoRow icon={Truck} label="Экспедитор">
          <InfoValueBox align="start">
            <span className="font-medium">{data.expeditor_display ?? data.expeditors ?? "—"}</span>
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Calendar} label="Дата отгрузки">
          <InfoValueBox>{formatOrderDetailDateTime(data.shipped_at)}</InfoValueBox>
        </InfoRow>

        <InfoRow icon={Package} label="Склад">
          <InfoValueBox align="start">
            <span className="font-medium">{data.warehouse_name ?? "—"}</span>
            {data.warehouse_block_name?.trim() ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Блок: {data.warehouse_block_name}
              </span>
            ) : null}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Calendar} label="Дата возврата">
          <InfoValueBox>
            {data.returned_at
              ? formatOrderDetailDateTime(data.returned_at)
              : data.delivered_at
                ? formatOrderDetailDateTime(data.delivered_at)
                : "—"}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Tag} label="Направление торговли">
          <InfoValueBox>
            {data.agent_trade_direction?.trim() ? (
              <span className="font-medium">{data.agent_trade_direction}</span>
            ) : (
              "—"
            )}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={ToggleLeft} label="Консигнация">
          <InfoValueBox>
            {data.is_consignment ? (
              <span className="font-medium text-teal-600">
                Да
                {data.consignment_due_date
                  ? ` · ${formatOrderDetailDateOnly(data.consignment_due_date)}`
                  : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">Нет</span>
            )}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Tag} label="Тип цены">
          <InfoValueBox>
            {data.payment_method_label?.trim() || data.price_type?.trim() || "—"}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={Percent} label="Скидка">
          <InfoValueBox>
            {Number(data.discount_sum ?? 0) > 0 ? (
              <span className="font-medium">Avto</span>
            ) : (
              <span className="text-muted-foreground">Без скидки</span>
            )}
          </InfoValueBox>
        </InfoRow>

        <InfoRow icon={MapPin} label="Локация">
          {mapHref ? (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-1.5 transition-colors hover:bg-muted"
            >
              <span className="truncate font-mono text-sm font-medium text-teal-600">{gpsText}</span>
              <ExternalLink className="size-4 shrink-0 text-teal-500" aria-hidden />
            </a>
          ) : (
            <InfoValueBox>—</InfoValueBox>
          )}
          {gpsText ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              title="Nusxa"
              onClick={() => void navigator.clipboard.writeText(gpsText)}
            >
              <Copy className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </InfoRow>

        <InfoRow icon={Gift} label="Бонус">
          <InfoValueBox>
            <span className="inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              {data.apply_bonus ? "Авто" : "Нет"}
            </span>
          </InfoValueBox>
        </InfoRow>

        {requestTypeLabel ? (
          <InfoRow icon={Tag} label="Тип заявки">
            <InfoValueBox align="start">{requestTypeLabel}</InfoValueBox>
          </InfoRow>
        ) : null}

        {data.created_by?.trim() || data.created_by_role?.trim() ? (
          <InfoRow icon={User} label="Создал">
            <InfoValueBox align="start">
              {[data.created_by, data.created_by_role].filter((x) => x?.trim()).join(" · ")}
            </InfoValueBox>
          </InfoRow>
        ) : null}

        {data.expected_ship_date ? (
          <InfoRow icon={Calendar} label="План отгрузки">
            <InfoValueBox>{formatOrderDetailDateTime(data.expected_ship_date)}</InfoValueBox>
          </InfoRow>
        ) : null}

        <div className="sm:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="size-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
            <span>Комментарий</span>
          </div>
          <div className="mt-2 max-w-xl">
            {canOperate && data.status !== "cancelled" ? (
              <div className="space-y-2">
                <textarea
                  className="min-h-[72px] w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  value={commentDraft}
                  onChange={(e) => onCommentChange(e.target.value)}
                  maxLength={4000}
                  disabled={commentSaving}
                  placeholder="Комментарий…"
                />
                {commentSaveError ? (
                  <p className="text-xs text-destructive" role="alert">
                    {commentSaveError}
                  </p>
                ) : null}
                {showCommentSave ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-teal-600 hover:bg-teal-700"
                    disabled={commentSaving}
                    onClick={onCommentSave}
                  >
                    {commentSaving ? "Сохранение…" : "Сохранить"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <InfoValueBox align="start" className="w-full">
                <span className="whitespace-pre-wrap">{data.comment?.trim() || "—"}</span>
              </InfoValueBox>
            )}
          </div>
        </div>
      </div>
    </OrderDetailCard>
  );
}
