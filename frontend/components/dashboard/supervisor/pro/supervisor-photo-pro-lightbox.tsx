"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";
import { useEffect, useState } from "react";

export type SupervisorPhotoProItem = {
  id: number;
  caption: string;
  clientName: string;
  category: string;
  createdAt: string;
  imageUrl: string;
  agentName?: string;
  city?: string | null;
};

export const supervisorPhotoProFallback =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="100%" height="100%" fill="#dfe8f3"/><g fill="#9db1c9" font-family="sans-serif" font-size="16" text-anchor="middle"><text x="50%" y="49%">Фото недоступно</text></g></svg>'
  );

export function formatSupervisorPhotoProTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function SupervisorPhotoProLightbox({
  photos,
  index,
  agentName,
  dateLabel,
  onClose,
  onNavigate
}: {
  photos: SupervisorPhotoProItem[];
  index: number;
  agentName: string;
  dateLabel: string;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const [zoom, setZoom] = useState(false);
  const active = photos[index];

  useEffect(() => setZoom(false), [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (zoom) setZoom(false);
        else onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onNavigate((index - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNavigate((index + 1) % photos.length);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, onClose, onNavigate, photos.length, zoom]);

  if (!active) return null;

  return (
    <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="lightbox-stage">
        <button
          type="button"
          className="lightbox-zoom"
          onClick={() => setZoom((v) => !v)}
          aria-label={zoom ? "Уменьшить" : "Увеличить"}
        >
          {zoom ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={`lightbox-img${zoom ? " zoomed" : ""}`}
          src={active.imageUrl}
          alt={active.caption}
          draggable={false}
          onClick={() => setZoom((v) => !v)}
          onError={(e) => {
            e.currentTarget.src = supervisorPhotoProFallback;
          }}
        />
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              className="lightbox-nav prev"
              onClick={() => onNavigate((index - 1 + photos.length) % photos.length)}
              aria-label="Предыдущее"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="lightbox-nav next"
              onClick={() => onNavigate((index + 1) % photos.length)}
              aria-label="Следующее"
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
        <div className="lightbox-counter">
          {index + 1} / {photos.length}
        </div>
      </div>
      <aside className="lightbox-meta">
        <div className="lightbox-head">
          <span className="photo-badge" style={{ position: "static" }}>
            {active.category}
          </span>
          <button
            type="button"
            className="lightbox-close-btn"
            onClick={onClose}
            aria-label="Закрыть просмотр"
          >
            <X size={18} />
          </button>
        </div>
        <h3>{active.clientName}</h3>
        <p>{active.caption}</p>
        <div className="lightbox-rows">
          <div>
            <span>Агент</span>
            <b>{agentName}</b>
          </div>
          <div>
            <span>Дата снимка</span>
            <b>
              {formatSupervisorPhotoProTime(active.createdAt)} · {dateLabel}
            </b>
          </div>
          <div>
            <span>Тип / подпись</span>
            <b>{active.category}</b>
          </div>
          <div>
            <span>№ снимка</span>
            <b>#{active.id}</b>
          </div>
        </div>
        <div className="lightbox-actions">
          <a href={active.imageUrl} target="_blank" rel="noreferrer">
            <Download size={14} /> Открыть в полном размере
          </a>
        </div>
      </aside>
    </div>
  );
}
