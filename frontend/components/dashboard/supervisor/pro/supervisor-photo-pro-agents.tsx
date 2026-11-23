"use client";

import { Camera, ChevronRight, UserRound } from "lucide-react";

export type SupervisorPhotoAgentRow = {
  id: string;
  name: string;
  photoCount: number;
  outlets: number;
  cities: string[];
  categories: string[];
};

export function SupervisorPhotoProAgentList({
  rows,
  onSelect
}: {
  rows: SupervisorPhotoAgentRow[];
  onSelect: (agentId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="photo-empty">
        <Camera size={26} />
        <b>Нет снимков за выбранную дату</b>
        <p>Измените дату или сбросьте фильтры</p>
      </div>
    );
  }

  return (
    <div className="photo-agent-list">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          className="photo-agent-row"
          onClick={() => onSelect(row.id)}
        >
          <i>
            <UserRound size={15} />
          </i>
          <div className="photo-agent-name">
            <b>{row.name}</b>
            <small>
              {row.cities.length ? row.cities.slice(0, 2).join(", ") : "—"}
              {row.cities.length > 2 ? ` +${row.cities.length - 2}` : ""}
            </small>
          </div>
          <span className="photo-agent-stat">
            точки <b>{row.outlets}</b>
          </span>
          <span className="photo-agent-stat">
            типы <b>{row.categories.length}</b>
          </span>
          <span className="photo-agent-stat accent">
            фото <b>{row.photoCount}</b>
          </span>
          <ChevronRight size={16} className="photo-agent-chevron" />
        </button>
      ))}
    </div>
  );
}
