"use client";

import {
  formatSupervisorPhotoProTime,
  supervisorPhotoProFallback,
  type SupervisorPhotoProItem
} from "@/components/dashboard/supervisor/pro/supervisor-photo-pro-lightbox";
import { ArrowLeft, Camera } from "lucide-react";

export function SupervisorPhotoProGrid({
  agentName,
  photos,
  total,
  viewLimit,
  onBack,
  onOpen
}: {
  agentName: string;
  photos: SupervisorPhotoProItem[];
  total: number;
  viewLimit: number;
  onBack: () => void;
  onOpen: (index: number) => void;
}) {
  return (
    <section className="panel photo-results">
      <div className="panel-head">
        <div>
          <button type="button" className="text-link photo-back" onClick={onBack}>
            <ArrowLeft size={13} /> К списку агентов
          </button>
          <h2>Снимки · {agentName}</h2>
          <p>
            Показано {photos.length} из {total}
            {total > viewLimit ? ` (лимит ${viewLimit})` : ""}
          </p>
        </div>
        <span className="photo-result-count">{photos.length} фото</span>
      </div>
      {photos.length === 0 ? (
        <div className="photo-empty">
          <Camera size={26} />
          <b>Нет снимков у этого агента</b>
        </div>
      ) : (
        <div className="photo-pro-grid">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="photo-card"
              onClick={() => onOpen(index)}
              aria-label={`Открыть фото ${photo.id}`}
            >
              <span className="photo-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.imageUrl}
                  alt={photo.caption}
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.src = supervisorPhotoProFallback;
                  }}
                />
                <span className="photo-thumb-shade" aria-hidden />
                <span className="photo-badge">{photo.category}</span>
                <span className="photo-thumb-time">
                  {formatSupervisorPhotoProTime(photo.createdAt)}
                </span>
              </span>
              <span className="photo-meta">
                <span className="photo-meta-top">
                  <b>{photo.clientName}</b>
                </span>
                <small>
                  {photo.city || "—"} · {photo.caption}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
