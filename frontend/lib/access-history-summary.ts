/** «История» kartochkasi: access_logs `old_value` / `new_value` ni qisqa ruscha matnga aylantirish. */

type Json = Record<string, unknown>;

function asObj(v: unknown): Json | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function ops(n: number): string {
  return `${n} ${plural(n, "операция", "операции", "операций")}`;
}

/** Yangi holat (PATCH tanasi va boshqa yozuvlar) — o'zgarishlar ro'yxati. */
export function summarizeAccessLogNew(newValue: unknown): string[] {
  const v = asObj(newValue);
  if (!v) return [];
  const out: string[] = [];
  const merge = v.merge_permissions === true;
  const allow = arr(v.permissions);
  const deny = arr(v.denied_permissions);
  const remove = arr(v.remove_permission_keys);
  const added = arr(v.added);
  const removed = arr(v.removed);
  if (allow.length) out.push(merge ? `Добавлено: ${ops(allow.length)}` : `Разрешения заменены: ${ops(allow.length)}`);
  if (deny.length) out.push(`Запрещено: ${ops(deny.length)}`);
  if (remove.length) out.push(`Откреплено: ${ops(remove.length)}`);
  if (added.length) out.push(`Добавлено в роль: ${ops(added.length)}`);
  if (arr(v.grant_delegation_allow).length) out.push(`Может выдавать: +${ops(arr(v.grant_delegation_allow).length)}`);
  if (arr(v.grant_delegation_revoke).length) out.push(`Может выдавать: −${ops(arr(v.grant_delegation_revoke).length)}`);
  if (typeof v.role === "string" && v.role) out.push(`Роль: ${v.role}`);
  if (typeof v.is_active === "boolean") out.push(v.is_active ? "Пользователь активирован" : "Пользователь деактивирован");
  if (Array.isArray(v.extra_role_keys)) out.push(`Группы операций: ${arr(v.extra_role_keys).length}`);
  if (Array.isArray(v.branch_codes)) out.push(`Филиалы: ${arr(v.branch_codes).length}`);
  if (Array.isArray(v.warehouse_ids)) out.push(`Склады: ${arr(v.warehouse_ids).length}`);
  if (Array.isArray(v.cash_desk_ids)) out.push(`Кассы: ${arr(v.cash_desk_ids).length}`);
  if (Array.isArray(v.payment_methods)) out.push(`Способы оплаты: ${arr(v.payment_methods).length}`);
  if (Array.isArray(v.territory_ids)) out.push(`Территории: ${arr(v.territory_ids).length}`);
  if (Array.isArray(v.trade_direction_ids)) out.push(`Направления: ${arr(v.trade_direction_ids).length}`);
  if (Array.isArray(v.supervisee_user_ids)) out.push(`Сотрудники: ${arr(v.supervisee_user_ids).length}`);
  if (v.reset === true) out.push("Сброс к роли по умолчанию");
  if (out.length === 0 && removed.length === 0) {
    const keys = Object.keys(v).filter((k) => k !== "merge_permissions");
    if (keys.length) out.push(`Изменено: ${keys.join(", ")}`);
  }
  return out;
}

/** Eski holat — faqat ma'lum maydonlar. */
export function summarizeAccessLogOld(oldValue: unknown): string[] {
  const v = asObj(oldValue);
  if (!v) return [];
  const out: string[] = [];
  if (typeof v.role === "string" && v.role) out.push(`Роль: ${v.role}`);
  if (typeof v.is_active === "boolean") out.push(v.is_active ? "Активен" : "Неактивен");
  if (arr(v.removed).length) out.push(`Удалено из роли: ${ops(arr(v.removed).length)}`);
  if (Array.isArray(v.permissions)) out.push(`Личных разрешений: ${arr(v.permissions).length}`);
  return out;
}
