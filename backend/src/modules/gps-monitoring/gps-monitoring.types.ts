/** GPS monitoring DTO — frontend VisitPoint / Employee bilan mos. */

export type GpsEmployeeType = "agent" | "delivery" | "supervisor" | "inkasator" | "vansell";

export type GpsVisitStatus = "ordered" | "visited" | "rejected" | "missed";

export type GpsVisitModule = "client" | "warehouse" | "cash" | "fuel" | "start";

export type GpsEmployeeDto = {
  id: string;
  code: string;
  name: string;
  territory: string;
  segment: string;
  type: GpsEmployeeType;
  supervisorId: string | null;
  battery: number | null;
  online: boolean;
  lastSeen: string;
  region: string;
};

/** GPS monitoring — mijozdagi fotootchyot (balloon / yon panel). */
export type GpsVisitPhotoDto = {
  id: number;
  caption: string | null;
  created_at: string;
  /** http(s) yoki qisqa preview; katta data-URL o‘tkazib yuboriladi */
  image_url?: string;
  content_purged: boolean;
};

export type GpsVisitPointDto = {
  id: string;
  index: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  planned: number;
  arrived: number | null;
  duration: number;
  expectedDuration: number;
  status: GpsVisitStatus;
  /** Legacy: summa mln so‘m (1 decimal) — chart/compat */
  orderSum: number;
  /** To‘liq zakaz summasi (so‘m) */
  orderAmount: number;
  /** Zakaz izohi */
  orderComment: string | null;
  /** «Причины заявок» label */
  orderReason: string | null;
  /** Otkaz sababi (label) */
  refusalReason: string | null;
  /** Otkaz izohi */
  refusalComment: string | null;
  /** Tashrif notes */
  visitNotes: string | null;
  sku: number;
  /** Oldingi nuqtagacha masofa (km) */
  distance: number;
  /** GPS ping → mijoz koordinatasi (km), bo‘lmasa null */
  distanceToClient: number | null;
  /** GPS mijoz radiusida (yoki tashrif bor) */
  wasAtPoint: boolean;
  placeType: string;
  accuracy: number;
  internet: "4G" | "3G" | "—";
  batteryAt: number | null;
  module: GpsVisitModule;
  cashExpected: number;
  cashCollected: number;
  payMethod: "Naqd" | "Terminal" | "Perechislenie";
  delivered: boolean;
  paid: boolean;
  photoUrl?: string;
  photoTaken: boolean;
  photoTime?: string;
  photos: GpsVisitPhotoDto[];
  customerEvidence: boolean;
  clientId: number | null;
};

export type GpsOverviewClusterDto = {
  id: string;
  lat: number;
  lng: number;
  count: number;
  label: string;
};

/** Overview xarita — har bir xodimning oxirgi GPS (yoki region fallback). */
export type GpsOverviewAgentDto = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  type: GpsEmployeeType;
  online: boolean;
};

export type GpsTradingPointDto = {
  id: string;
  lat: number;
  lng: number;
  name: string;
};

export type GpsTrackPointDto = {
  lat: number;
  lng: number;
  /** Kun ichidagi soat (0–24), masalan 11.5 = 11:30 */
  hour: number;
};

export type GpsDayResponse = {
  employee: GpsEmployeeDto;
  points: GpsVisitPointDto[];
  track: GpsTrackPointDto[];
  date: string;
};

export const ONLINE_MAX_AGE_MS = 15 * 60 * 1000;
