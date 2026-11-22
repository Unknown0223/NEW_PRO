export type TabelMarkRow = {
  id: number;
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  user_code: string | null;
  work_date_ymd: string;
  occurred_at: string;
  direction: "IN" | "OUT";
  role_in_day: "in" | "estimated_out" | "out";
  source: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  outside_geofence: boolean;
  location_name: string | null;
  day_code: number | null;
  face_score: number | null;
  is_valid: boolean;
  review_status: string;
  comment: string | null;
  has_photo_front: boolean;
  has_photo_back: boolean;
  has_video_front: boolean;
  has_video_back: boolean;
  integrity_json?: {
    verdict?: string;
    failedMessage?: string | null;
    distanceMeters?: number | null;
  };
  problem_reasons?: string[];
};

export type OpenDayRow = {
  user_id: number;
  user_fio: string;
  user_role: string;
  user_branch: string | null;
  work_date_ymd: string;
  first_in_at: string;
};

export const ROLE_IN_DAY_LABEL: Record<string, { label: string; cls: string }> = {
  in: { label: "1-я отметка · Приход", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  estimated_out: { label: "Промежуточная · Примерный уход", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  out: { label: "Официальный уход", cls: "bg-sky-100 text-sky-800 border-sky-200" }
};

export const SOURCE_BADGE: Record<string, string> = {
  mobile_photo: "Фото + Face ID",
  mobile_video: "Видео + 3-код",
  kiosk: "Киоск бригады",
  terminal: "Терминал Face ID",
  gps: "GPS визит",
  manual: "Вручную"
};

export const MARKS_PAGE_SIZE = 50;

export const MEDIA_SLOT_LABEL: Record<string, string> = {
  photo_front: "Фронтальная камера",
  photo_back: "Задняя камера",
  video_front: "Видео, фронт",
  video_back: "Видео, задняя камера"
};

export function markNeedsReview(row: TabelMarkRow): boolean {
  return !row.is_valid || row.review_status === "pending";
}
