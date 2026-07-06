/** Minimal client fields for map balloon (avoids circular import with map component). */
export type ClientMapBalloonClient = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  client_code: string | null;
  is_active: boolean;
  lat: number;
  lon: number;
};

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayText(v: string | null | undefined, max = 48): string {
  const t = (v ?? "").trim();
  if (!t) return "—";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function formatLocation(c: ClientMapBalloonClient): string {
  const parts = [c.city, c.region].map((x) => (x ?? "").trim()).filter(Boolean);
  if (parts.length === 0) {
    const addr = (c.address ?? "").trim();
    return addr || "—";
  }
  return parts.join(", ");
}

/** Yandex Maps `balloonContent` — shablon: foto placeholder + maydonlar */
export function buildClientMapBalloonHtml(c: ClientMapBalloonClient, clientHref?: string): string {
  const href = clientHref ?? `/clients/${c.id}`;
  const safeName = escapeHtml(c.name);
  const status = c.is_active ? "Активный" : "Неактивный";
  const statusColor = c.is_active ? "#22c55e" : "#94a3b8";
  const phone = escapeHtml(displayText(c.phone, 28));
  const location = escapeHtml(formatLocation(c));
  const code = escapeHtml(displayText(c.client_code, 24));
  const coords = escapeHtml(formatCoords(c.lat, c.lon));

  return `
<div class="client-map-balloon" style="display:flex;gap:10px;min-width:248px;max-width:300px;padding:2px 0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;line-height:1.35;color:#0f172a">
  <div style="width:56px;height:56px;flex-shrink:0;border-radius:4px;background:#e2e8f0;border:1px solid #cbd5e1" aria-hidden="true"></div>
  <div style="flex:1;min-width:0">
    <a href="${escapeHtml(href)}" style="display:block;font-size:13px;font-weight:700;color:#0369a1;text-decoration:none;line-height:1.25;word-break:break-word">${safeName}</a>
    <div style="margin-top:4px;display:flex;align-items:center;gap:6px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${statusColor}"></span>
      <span style="color:#334155">${escapeHtml(status)}</span>
    </div>
    <div style="margin-top:6px;color:#334155">Тел: <span style="font-weight:600">${phone}</span></div>
    <div style="margin-top:2px;color:#334155">Локация: <span>${location}</span></div>
    <div style="margin-top:2px;color:#64748b">Код: ${code} • ID: ${c.id}</div>
    <div style="margin-top:4px;font-family:ui-monospace,monospace;font-size:10px;color:#64748b">${coords}</div>
  </div>
</div>`.trim();
}
