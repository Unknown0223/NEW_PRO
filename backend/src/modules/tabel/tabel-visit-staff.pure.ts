/** Kunlik xodimlar ro‘yxati — visit dashboard uchun (testable). */

export type VisitStaffPerson = {
  id: number;
  name: string;
  branch: string | null;
  role: string;
};

export type VisitStaffDayRecord = {
  user_id: number;
  status: string;
  late_minutes: number;
  late_excused: boolean;
};

export type VisitStaffPunch = {
  id: number;
  user_id: number;
  occurred_at: string;
  direction: "IN" | "OUT";
  photo_front_key: string | null;
};

export type VisitStaffRow = {
  id: number;
  name: string;
  branch: string | null;
  role: string;
  status: string;
  late_minutes: number;
  late_excused: boolean;
  punch_id: number | null;
  first_in_at: string | null;
  last_out_at: string | null;
  has_photo: boolean;
};

const PRESENT = new Set([
  "worked",
  "late",
  "half_day",
  "overtime",
  "weekend_work",
  "remote",
  "early_leave"
]);

function presentRank(status: string): number {
  if (PRESENT.has(status)) return 0;
  if (status === "absent" || status === "no_mark") return 2;
  return 1;
}

/** Fokus kun uchun barcha aktiv xodimlar + foto otmetka. */
export function buildVisitStaffRows(
  people: VisitStaffPerson[],
  dayRecords: VisitStaffDayRecord[],
  punches: VisitStaffPunch[]
): VisitStaffRow[] {
  const statusByUser = new Map(dayRecords.map((r) => [r.user_id, r]));
  const punchesByUser = new Map<number, VisitStaffPunch[]>();
  for (const p of punches) {
    const list = punchesByUser.get(p.user_id) ?? [];
    list.push(p);
    punchesByUser.set(p.user_id, list);
  }

  const rows: VisitStaffRow[] = people.map((person) => {
    const day = statusByUser.get(person.id);
    const list = (punchesByUser.get(person.id) ?? []).slice().sort((a, b) =>
      a.occurred_at.localeCompare(b.occurred_at)
    );
    const firstIn = list.find((p) => p.direction === "IN") ?? list[0] ?? null;
    const lastOut =
      [...list].reverse().find((p) => p.direction === "OUT") ??
      (list.length > 1 ? list[list.length - 1] : null);
    const photoPunch = list.find((p) => Boolean(p.photo_front_key)) ?? null;
    const status = day?.status ?? (list.length ? "worked" : "no_mark");
    return {
      id: person.id,
      name: person.name,
      branch: person.branch,
      role: person.role,
      status,
      late_minutes: day?.late_minutes ?? 0,
      late_excused: day?.late_excused ?? false,
      punch_id: photoPunch?.id ?? null,
      first_in_at: firstIn?.occurred_at ?? null,
      last_out_at: lastOut && lastOut !== firstIn ? lastOut.occurred_at : null,
      has_photo: Boolean(photoPunch)
    };
  });

  return rows.sort((a, b) => {
    const pr = presentRank(a.status) - presentRank(b.status);
    if (pr !== 0) return pr;
    return a.name.localeCompare(b.name, "ru");
  });
}
