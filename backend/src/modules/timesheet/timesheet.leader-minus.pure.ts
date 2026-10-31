import type { LeaderMinusRule } from "./timesheet.agent-norm.pure";
import type { NormDay } from "./timesheet.agent-norm.pure";

export type LeaderMinusPerson = {
  user_id: number;
  fio: string;
  role: string;
  supervisor_user_id: number | null;
  days: NormDay[];
};

function fmtRu(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

function ruleFor(person: LeaderMinusPerson, rules: LeaderMinusRule[]): LeaderMinusRule | null {
  const personal = rules.find((r) => r.enabled && r.user_id === person.user_id && r.threshold >= 1);
  if (personal) return personal;
  const role = person.role.trim().toLowerCase();
  return (
    rules.find((r) => r.enabled && r.user_id == null && r.role === role && r.threshold >= 1) ?? null
  );
}

function absentDates(person: LeaderMinusPerson, today: string): string[] {
  return person.days
    .filter((d) => d.status === "absent" && !d.off_employment && d.date <= today)
    .map((d) => d.date)
    .sort();
}

type Trigger = { date: string; comment: string };

function triggers(team: LeaderMinusPerson[], rule: LeaderMinusRule, today: string): Trigger[] {
  if (rule.mode === "per_agent") {
    const out: Trigger[] = [];
    for (const agent of [...team].sort((a, b) => a.fio.localeCompare(b.fio, "ru") || a.user_id - b.user_id)) {
      const days = absentDates(agent, today);
      if (days.length < rule.threshold) continue;
      out.push({
        date: days[rule.threshold - 1]!,
        comment: `Авто: у агента ${agent.fio} ${days.length} дн. с минусом (0). Порог ${rule.threshold} по каждому агенту — руководителю один минус.`
      });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.comment.localeCompare(b.comment, "ru"));
  }

  const events: { date: string; fio: string }[] = [];
  for (const agent of team) {
    for (const date of absentDates(agent, today)) events.push({ date, fio: agent.fio });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.fio.localeCompare(b.fio, "ru"));
  const out: Trigger[] = [];
  for (let n = rule.threshold; n <= events.length; n += rule.threshold) {
    const hit = events[n - 1]!;
    out.push({
      date: hit.date,
      comment: `Авто: сумма минусов всех агентов достигла ${n} (порог ${rule.threshold}). Руководителю один минус.`
    });
  }
  return out;
}

function place(leader: LeaderMinusPerson, wanted: string, comment: string, today: string): void {
  const days = [...leader.days].sort((a, b) => a.date.localeCompare(b.date));
  let idx = days.findIndex((d) => d.date === wanted);
  if (idx < 0) idx = days.length - 1;
  const start = days[idx]?.date ?? wanted;
  while (idx >= 0) {
    const d = days[idx]!;
    if (d.date > today) {
      idx -= 1;
      continue;
    }
    const free = !d.manual && !d.off_employment && d.status !== "absent";
    if (free) {
      const shifted = d.date !== start;
      d.status = "absent";
      d.source = "auto";
      d.comment = shifted
        ? `${comment} День ${fmtRu(start)} уже занят другим минусом, поэтому минус перенесён на ${fmtRu(d.date)}.`
        : comment;
      return;
    }
    idx -= 1;
  }
}

/**
 * Rahbar qatoriga agentlarning «0» kunlari bo‘yicha bitta minus qo‘yadi.
 * Bir kunga ikkita minus tushsa, ikkinchisi oldingi bo‘sh kunga suriladi va izoh yoziladi.
 * Qo‘lda belgilangan kun o‘zgarmaydi.
 */
export function applyLeaderMinusRules(people: LeaderMinusPerson[], rules: LeaderMinusRule[], today: string): void {
  if (rules.length === 0 || people.length === 0) return;
  const agents = people.filter((p) => p.role.trim().toLowerCase() === "agent");
  for (const leader of people) {
    const rule = ruleFor(leader, rules);
    if (!rule) continue;
    const team = agents.filter((a) => a.supervisor_user_id === leader.user_id);
    if (team.length === 0) continue;
    for (const hit of triggers(team, rule, today)) {
      place(leader, hit.date, hit.comment, today);
    }
  }
}
