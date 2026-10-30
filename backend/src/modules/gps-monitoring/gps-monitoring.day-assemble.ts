import { Prisma } from "@prisma/client";
import { haversineKm, hourFloatFromDate, num } from "./gps-monitoring.helpers";
import {
  asStops,
  toPhotoDto,
  WAS_AT_POINT_KM
} from "./gps-monitoring.day-mappers";
import { nearestPingMeta } from "./gps-monitoring.ping-meta";
import type {
  GpsDayResponse,
  GpsEmployeeDto,
  GpsVisitModule,
  GpsVisitPhotoDto,
  GpsVisitPointDto,
  GpsVisitStatus
} from "./gps-monitoring.types";

type GeoClient = { id: number; name: string; address: string | null; latitude: unknown; longitude: unknown };

export function assembleGpsMonitoringDay(input: {
  employee: GpsEmployeeDto;
  employeeId: number;
  dateIso: string;
  routeStops: Prisma.JsonValue | null | undefined;
  visits: Array<{
    id: number;
    client_id: number | null;
    latitude: unknown;
    longitude: unknown;
    checked_in_at: Date;
    checked_out_at: Date | null;
    notes: string | null;
    client: GeoClient | null;
  }>;
  orders: Array<{
    id: number;
    client_id: number;
    total_sum: unknown;
    status: string;
    created_at: Date;
    comment: string | null;
    request_type_ref: string | null;
    _count: { items: number };
    client: GeoClient;
  }>;
  refusals: Array<{
    id: number;
    client_id: number;
    created_at: Date;
    refusal_reason_ref: string | null;
    comment: string | null;
    client: GeoClient;
  }>;
  pings: Array<{
    latitude: Prisma.Decimal;
    longitude: Prisma.Decimal;
    recorded_at: Date;
    battery_pct?: number | null;
    network_type?: string | null;
  }>;
  payments: Array<{
    client_id: number;
    amount: unknown;
    payment_type: string;
    created_at: Date;
    client: GeoClient;
  }>;
  photos: Array<{
    id: number;
    client_id: number;
    caption: string | null;
    created_at: Date;
    image_url: string;
    content_purged_at: Date | null;
  }>;
  refusalLabels: Map<string, string>;
  requestTypeLabels: Map<string, string>;
}): GpsDayResponse {
  const {
    employee,
    employeeId,
    dateIso,
    visits,
    orders,
    refusals,
    pings,
    payments,
    photos,
    refusalLabels,
    requestTypeLabels
  } = input;
  const routeDay = { stops: input.routeStops ?? [] };
  type Acc = {
    clientId: number | null;
    name: string;
    address: string;
    lat: number;
    lng: number;
    planned: number;
    arrived: number | null;
    status: GpsVisitStatus;
    orderSum: number;
    orderAmount: number;
    orderComment: string | null;
    orderReason: string | null;
    refusalReason: string | null;
    refusalComment: string | null;
    visitNotes: string | null;
    sku: number;
    accuracy: number;
    module: GpsVisitModule;
    cashExpected: number;
    cashCollected: number;
    payMethod: GpsVisitPointDto["payMethod"];
    delivered: boolean;
    paid: boolean;
    duration: number;
    photos: GpsVisitPhotoDto[];
  };

  const byClient = new Map<string, Acc>();
  const keyOf = (cid: number | null, fallback: string) =>
    cid != null ? `c:${cid}` : `x:${fallback}`;

  const upsert = (k: string, patch: Partial<Acc> & Pick<Acc, "name" | "lat" | "lng">) => {
    const prev = byClient.get(k);
    if (!prev) {
      byClient.set(k, {
        clientId: patch.clientId ?? null,
        name: patch.name,
        address: patch.address ?? "—",
        lat: patch.lat,
        lng: patch.lng,
        planned: patch.planned ?? 9,
        arrived: patch.arrived ?? null,
        status: patch.status ?? "missed",
        orderSum: patch.orderSum ?? 0,
        orderAmount: patch.orderAmount ?? 0,
        orderComment: patch.orderComment ?? null,
        orderReason: patch.orderReason ?? null,
        refusalReason: patch.refusalReason ?? null,
        refusalComment: patch.refusalComment ?? null,
        visitNotes: patch.visitNotes ?? null,
        sku: patch.sku ?? 0,
        accuracy: patch.accuracy ?? 12,
        module: patch.module ?? "client",
        cashExpected: patch.cashExpected ?? 0,
        cashCollected: patch.cashCollected ?? 0,
        payMethod: patch.payMethod ?? "Naqd",
        delivered: patch.delivered ?? false,
        paid: patch.paid ?? false,
        duration: patch.duration ?? 0,
        photos: patch.photos ?? []
      });
      return;
    }
    if (patch.arrived != null && (prev.arrived == null || patch.arrived < prev.arrived)) {
      prev.arrived = patch.arrived;
    }
    if (patch.planned != null) prev.planned = Math.min(prev.planned, patch.planned);
    if (patch.orderSum) prev.orderSum += patch.orderSum;
    if (patch.orderAmount) prev.orderAmount += patch.orderAmount;
    if (patch.sku) prev.sku += patch.sku;
    if (patch.cashCollected) prev.cashCollected += patch.cashCollected;
    if (patch.cashExpected) prev.cashExpected += patch.cashExpected;
    if (patch.delivered) prev.delivered = true;
    if (patch.paid) prev.paid = true;
    if (patch.status === "ordered") prev.status = "ordered";
    else if (patch.status === "rejected" && prev.status !== "ordered") prev.status = "rejected";
    else if (patch.status === "visited" && prev.status === "missed") prev.status = "visited";
    if (patch.address && patch.address !== "—") prev.address = patch.address;
    if (patch.accuracy) prev.accuracy = patch.accuracy;
    if (patch.duration) prev.duration = Math.max(prev.duration, patch.duration);
    if (patch.orderComment) prev.orderComment = patch.orderComment;
    if (patch.orderReason) prev.orderReason = patch.orderReason;
    if (patch.refusalReason) prev.refusalReason = patch.refusalReason;
    if (patch.refusalComment) prev.refusalComment = patch.refusalComment;
    if (patch.visitNotes) prev.visitNotes = patch.visitNotes;
    if (patch.photos?.length) prev.photos = [...prev.photos, ...patch.photos];
  };

  const stops = asStops(routeDay?.stops ?? []);
  stops.forEach((s, i) => {
    const cid = num(s.client_id);
    const lat = num(s.latitude) ?? 41.31;
    const lng = num(s.longitude) ?? 69.26;
    upsert(keyOf(cid, `stop-${i}`), {
      clientId: cid,
      name: s.client_name?.trim() || `Точка ${i + 1}`,
      address: "—",
      lat,
      lng,
      planned: 8.8 + i * 0.45,
      arrived: null,
      status: "missed",
      module: i === 0 ? "start" : "client"
    });
  });

  for (const v of visits) {
    const lat = num(v.latitude) ?? num(v.client?.latitude) ?? 41.31;
    const lng = num(v.longitude) ?? num(v.client?.longitude) ?? 69.26;
    const arrived = hourFloatFromDate(v.checked_in_at);
    let duration = 8;
    if (v.checked_out_at) {
      duration = Math.max(1, Math.round((v.checked_out_at.getTime() - v.checked_in_at.getTime()) / 60000));
    }
    upsert(keyOf(v.client_id, `visit-${v.id}`), {
      clientId: v.client_id,
      name: v.client?.name ?? `Визит #${v.id}`,
      address: v.client?.address?.trim() || "—",
      lat,
      lng,
      planned: arrived,
      arrived,
      status: "visited",
      accuracy: 10,
      duration,
      module: "client",
      visitNotes: v.notes?.trim() || null
    });
  }

  for (const o of orders) {
    const lat = num(o.client.latitude) ?? 41.31;
    const lng = num(o.client.longitude) ?? 69.26;
    const arrived = hourFloatFromDate(o.created_at);
    const amount = Number(o.total_sum);
    const sumMln = amount / 1_000_000;
    const delivered =
      employee.type === "delivery" || employee.type === "vansell"
        ? !["new", "cancelled", "canceled"].includes(o.status.toLowerCase())
        : false;
    const reasonRef = o.request_type_ref?.trim() || null;
    upsert(keyOf(o.client_id, `order-${o.id}`), {
      clientId: o.client_id,
      name: o.client.name,
      address: o.client.address?.trim() || "—",
      lat,
      lng,
      planned: arrived,
      arrived,
      status: "ordered",
      orderSum: Math.round(sumMln * 10) / 10,
      orderAmount: Math.round(amount),
      orderComment: o.comment?.trim() || null,
      orderReason: reasonRef
        ? requestTypeLabels.get(reasonRef) ?? reasonRef
        : null,
      sku: o._count.items,
      delivered,
      paid: employee.type === "vansell",
      module: "client"
    });
  }

  for (const r of refusals) {
    const lat = num(r.client.latitude) ?? 41.31;
    const lng = num(r.client.longitude) ?? 69.26;
    const arrived = hourFloatFromDate(r.created_at);
    const reasonRef = r.refusal_reason_ref?.trim() || "";
    upsert(keyOf(r.client_id, `ref-${r.id}`), {
      clientId: r.client_id,
      name: r.client.name,
      address: r.client.address?.trim() || "—",
      lat,
      lng,
      planned: arrived,
      arrived,
      status: "rejected",
      module: "client",
      refusalReason: reasonRef ? refusalLabels.get(reasonRef) ?? reasonRef : null,
      refusalComment: r.comment?.trim() || null
    });
  }

  for (const p of payments) {
    const lat = num(p.client.latitude) ?? 41.31;
    const lng = num(p.client.longitude) ?? 69.26;
    const arrived = hourFloatFromDate(p.created_at);
    const amt = Number(p.amount) / 1_000_000;
    const payMethod: GpsVisitPointDto["payMethod"] = /terminal|card/i.test(p.payment_type)
      ? "Terminal"
      : /perech|transfer|bank/i.test(p.payment_type)
        ? "Perechislenie"
        : "Naqd";
    upsert(keyOf(p.client_id, `pay-${p.client_id}-${arrived}`), {
      clientId: p.client_id,
      name: p.client.name,
      address: p.client.address?.trim() || "—",
      lat,
      lng,
      planned: arrived,
      arrived,
      status: "visited",
      cashExpected: Math.round(amt * 10) / 10,
      cashCollected: Math.round(amt * 10) / 10,
      payMethod,
      module: "cash"
    });
  }

  const photosByClient = new Map<number, GpsVisitPhotoDto[]>();
  for (const ph of photos) {
    const dto = toPhotoDto(ph);
    const list = photosByClient.get(ph.client_id) ?? [];
    if (list.length < 6) list.push(dto);
    photosByClient.set(ph.client_id, list);
  }
  for (const [cid, list] of photosByClient) {
    const k = keyOf(cid, `photo-${cid}`);
    if (!byClient.has(k)) continue;
    upsert(k, {
      name: byClient.get(k)!.name,
      lat: byClient.get(k)!.lat,
      lng: byClient.get(k)!.lng,
      photos: list
    });
  }

  const sorted = [...byClient.values()].sort((a, b) => a.planned - b.planned);
  const points: GpsVisitPointDto[] = [];
  let prev: { lat: number; lng: number } | null = null;
  sorted.forEach((row, i) => {
    const distance = prev ? haversineKm(prev.lat, prev.lng, row.lat, row.lng) * 1.25 : 0;
    const clientPhotos =
      row.clientId != null ? photosByClient.get(row.clientId) ?? row.photos : row.photos;
    const firstPhoto = clientPhotos.find((p) => p.image_url);
    const distanceToClientMeta = nearestPingMeta(pings, row.lat, row.lng, row.arrived);
    const distanceToClient = distanceToClientMeta.distanceKm;
    const wasAtPoint =
      distanceToClient != null
        ? distanceToClient <= WAS_AT_POINT_KM
        : row.arrived != null;

    points.push({
      id: `${employeeId}-${dateIso}-${i}`,
      index: i + 1,
      name: row.name,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      planned: row.planned,
      arrived: row.arrived,
      duration: row.duration || (row.arrived != null ? 8 : 0),
      expectedDuration: 10,
      status: row.status,
      orderSum: row.orderSum,
      orderAmount: row.orderAmount,
      orderComment: row.orderComment,
      orderReason: row.orderReason,
      refusalReason: row.refusalReason,
      refusalComment: row.refusalComment,
      visitNotes: row.visitNotes,
      sku: row.sku,
      distance: Math.round(distance * 100) / 100,
      distanceToClient,
      wasAtPoint,
      placeType: "ТТ",
      accuracy: row.accuracy,
      internet: distanceToClientMeta.internet,
      batteryAt: distanceToClientMeta.batteryAt,
      module: row.module,
      cashExpected: row.cashExpected,
      cashCollected: row.cashCollected,
      payMethod: row.payMethod,
      delivered: row.delivered,
      paid: row.paid,
      photoUrl: firstPhoto?.image_url,
      photoTaken: clientPhotos.length > 0,
      photoTime: clientPhotos[0]
        ? hourFloatFromDate(new Date(clientPhotos[0].created_at)).toFixed(2)
        : undefined,
      photos: clientPhotos,
      customerEvidence: clientPhotos.length > 0,
      clientId: row.clientId
    });
    prev = { lat: row.lat, lng: row.lng };
  });

  const track = pings.map((p) => {
    const t = p.recorded_at;
    const hour = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
    return {
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      hour: Math.round(hour * 1000) / 1000
    };
  });

  return {
    employee,
    points,
    track,
    date: dateIso
  };
}
