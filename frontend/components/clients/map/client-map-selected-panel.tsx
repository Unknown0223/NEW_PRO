"use client";

import type { ClientMapPoint } from "@/components/clients/clients-leaflet-map";
import { clientVisitWeekdays } from "@/lib/client-map-filters";
import { MapPin } from "lucide-react";
import Link from "next/link";

const WD_SHORT = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatAddressLine(client: ClientMapPoint): string {
  const street = (client.address ?? "").trim();
  const city = (client.city ?? "").trim();
  const region = (client.region ?? "").trim();
  const parts = [street, city, region].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatCityRegionSubline(client: ClientMapPoint): string | null {
  const city = (client.city ?? "").trim();
  const region = (client.region ?? "").trim();
  if (!city && !region) return null;
  if (city && region && formatAddressLine(client).includes(city)) return null;
  return [city, region].filter(Boolean).join(", ");
}

export function ClientMapSelectedPanel({
  client,
  clientTypeLabel,
  onClose
}: {
  client: ClientMapPoint;
  clientTypeLabel?: string;
  onClose: () => void;
}) {
  const visitDays = clientVisitWeekdays(client).map((d) => WD_SHORT[d] ?? String(d));
  const category = (client.category ?? "").trim() || "—";
  const status = client.is_active ? "Активный" : "Не активный";
  const type = clientTypeLabel?.trim() || client.client_type_code?.trim() || "—";
  const agent = client.agent_name?.trim() || "—";
  const zone = client.zone?.trim() || "—";
  const gps = `${client.lat.toFixed(4)}, ${client.lon.toFixed(4)}`;
  const addressMain = formatAddressLine(client);
  const addressSub = formatCityRegionSubline(client);

  return (
    <div className="absolute right-4 top-4 z-[1000] w-80 rounded-lg border border-border bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="pr-2 font-semibold leading-tight text-slate-900">{client.name}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xl leading-none text-slate-400 transition hover:text-slate-600"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <div className="text-slate-800">{addressMain}</div>
            {addressSub ? <div className="text-xs text-slate-500">{addressSub}</div> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border pt-2">
          <Info label="Категория" value={category} />
          <Info label="Статус" value={status} />
          <Info label="Тип" value={type} />
          <Info label="Агент" value={agent} />
          <Info label="Зона" value={zone} />
          <Info label="GPS" value={gps} />
        </div>

        {visitDays.length > 0 ? (
          <div className="border-t border-border pt-2">
            <div className="mb-1 text-xs text-slate-500">Дни визита:</div>
            <div className="flex flex-wrap gap-1">
              {visitDays.map((d) => (
                <span key={d} className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                  {d}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <Link
          href={`/clients/${client.id}`}
          className="mt-3 block rounded-md bg-teal-600 py-2 text-center text-xs font-medium text-white transition hover:bg-teal-700"
        >
          Открыть карточку клиента →
        </Link>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-xs font-medium text-slate-800">{value}</div>
    </div>
  );
}
