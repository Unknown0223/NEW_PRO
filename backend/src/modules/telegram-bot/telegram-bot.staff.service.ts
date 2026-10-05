import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { resolveTenantSlugAlias } from "../../lib/tenant-slug-alias";
import {
  decideTelegramBind,
  isTelegramBotAllowedRole,
  normSmartCode,
  telegramBotCanAddClients,
  telegramBotCanDownloadIntake
} from "./telegram-bot.bind";

export type TelegramBotStaffDto = {
  tenant_id: number;
  tenant_slug: string;
  salec_user_id: number;
  /** Platformadagi haqiqiy rol */
  role: string;
  can_add_clients: boolean;
  can_download_intake: boolean;
  login: string;
  smart_code: string;
  agent_code: string | null;
  display_name: string | null;
  supervisor_user_id: number | null;
  telegram_id: string;
};

export type TelegramBotStaffFail = {
  ok: false;
  reason:
    | "not_found"
    | "bad_creds"
    | "inactive"
    | "bad_role"
    | "bad_smart"
    | "telegram_taken"
    | "staff_bound_other_telegram"
    | "unbound";
  message: string;
};

export type TelegramBotStaffOk = { ok: true; user: TelegramBotStaffDto };

const MSG: Record<TelegramBotStaffFail["reason"], string> = {
  not_found: "Сотрудник не найден. Отправьте логин или код из панели.",
  bad_creds: "Неверный пароль.",
  inactive: "Ваша учётная запись неактивна.",
  bad_role:
    "Бот доступен агентам (добавление клиентов) и сотрудникам платформы (Excel по территории/команде). Для этой роли он недоступен.",
  bad_smart: "Смарт-код не совпадает.",
  telegram_taken: "Этот аккаунт Telegram привязан к другому сотруднику. Войти с другого аккаунта нельзя.",
  staff_bound_other_telegram:
    "Этот сотрудник уже зарегистрирован в другом аккаунте Telegram. Войти с другого Telegram нельзя.",
  unbound: "Этот аккаунт Telegram пока не привязан ни к одному сотруднику."
};

function fail(reason: TelegramBotStaffFail["reason"]): TelegramBotStaffFail {
  return { ok: false, reason, message: MSG[reason] };
}

function dtoFrom(
  user: {
    id: number;
    tenant_id: number;
    name: string;
    login: string;
    role: string;
    code: string | null;
    supervisor_user_id: number | null;
    tenant: { slug: string };
  },
  slotCode: string,
  telegramId: string
): TelegramBotStaffDto {
  return {
    tenant_id: user.tenant_id,
    tenant_slug: user.tenant.slug,
    salec_user_id: user.id,
    role: user.role,
    can_add_clients: telegramBotCanAddClients(user.role),
    can_download_intake: telegramBotCanDownloadIntake(user.role),
    login: user.login,
    smart_code: slotCode,
    agent_code: user.code,
    display_name: user.name,
    supervisor_user_id: user.supervisor_user_id,
    telegram_id: telegramId
  };
}

async function findStaff(tenantSlug: string, identity: string) {
  const ident = identity.trim();
  if (!ident) return null;
  const identFilter = {
    OR: [
      { login: { equals: ident, mode: "insensitive" as const } },
      { code: { equals: ident, mode: "insensitive" as const } },
      {
        slot_user_links: {
          some: {
            ended_at: null,
            slot: { deleted_at: null, slot_code: { equals: ident, mode: "insensitive" as const } }
          }
        }
      }
    ]
  };
  const scoped = await prisma.user.findFirst({
    where: { tenant: { slug: resolveTenantSlugAlias(tenantSlug) }, ...identFilter },
    select: {
      id: true,
      tenant_id: true,
      name: true,
      login: true,
      password_hash: true,
      role: true,
      is_active: true,
      code: true,
      supervisor_user_id: true,
      tenant: { select: { slug: true } }
    }
  });
  if (scoped) return scoped;
  return prisma.user.findFirst({
    where: identFilter,
    select: {
      id: true,
      tenant_id: true,
      name: true,
      login: true,
      password_hash: true,
      role: true,
      is_active: true,
      code: true,
      supervisor_user_id: true,
      tenant: { select: { slug: true } }
    }
  });
}

async function activeSlots(userId: number, tenantId: number) {
  return prisma.workSlot.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      user_links: { some: { user_id: userId, ended_at: null } }
    },
    select: { slot_code: true, slot_type: true }
  });
}

export async function lookupTelegramStaff(telegramId: number): Promise<TelegramBotStaffOk | TelegramBotStaffFail> {
  const link = await prisma.telegramStaffLink.findUnique({
    where: { telegram_id: BigInt(telegramId) },
    select: { user_id: true, tenant_id: true, telegram_id: true }
  });
  if (!link) return fail("unbound");
  const user = await prisma.user.findFirst({
    where: { id: link.user_id, tenant_id: link.tenant_id },
    select: {
      id: true,
      tenant_id: true,
      name: true,
      login: true,
      role: true,
      is_active: true,
      code: true,
      supervisor_user_id: true,
      tenant: { select: { slug: true } }
    }
  });
  if (!user || !user.is_active) return fail("inactive");
  if (!isTelegramBotAllowedRole(user.role)) return fail("bad_role");
  const slots = await activeSlots(user.id, user.tenant_id);
  const slotCode = slots[0]?.slot_code ?? "";
  await prisma.telegramStaffLink.update({
    where: { user_id: user.id },
    data: { last_seen_at: new Date() }
  });
  return { ok: true, user: dtoFrom(user, slotCode, telegramId.toString()) };
}

export async function registerTelegramStaff(input: {
  tenantSlug: string;
  login: string;
  password: string;
  smartCode: string;
  telegramId: number;
}): Promise<TelegramBotStaffOk | TelegramBotStaffFail> {
  const user = await findStaff(input.tenantSlug, input.login);
  if (!user) return fail("not_found");
  const passOk = await bcrypt.compare(input.password, user.password_hash);
  if (!passOk) return fail("bad_creds");
  if (!user.is_active) return fail("inactive");
  if (!isTelegramBotAllowedRole(user.role)) return fail("bad_role");

  const want = normSmartCode(input.smartCode);
  const slots = await activeSlots(user.id, user.tenant_id);
  const hit = slots.find((s) => normSmartCode(s.slot_code) === want);
  if (!hit) return fail("bad_smart");

  const tg = String(input.telegramId);
  const [byTelegram, byUser] = await Promise.all([
    prisma.telegramStaffLink.findUnique({
      where: { telegram_id: BigInt(input.telegramId) },
      select: { user_id: true }
    }),
    prisma.telegramStaffLink.findUnique({
      where: { user_id: user.id },
      select: { telegram_id: true }
    })
  ]);
  const decision = decideTelegramBind({
    telegramId: tg,
    staffUserId: user.id,
    byTelegramUserId: byTelegram?.user_id ?? null,
    boundTelegramId: byUser ? byUser.telegram_id.toString() : null
  });
  if (!decision.ok) return fail(decision.reason);

  if (decision.alreadyBound) {
    await prisma.telegramStaffLink.update({
      where: { user_id: user.id },
      data: { last_seen_at: new Date() }
    });
  } else {
    try {
      await prisma.telegramStaffLink.create({
        data: {
          tenant_id: user.tenant_id,
          user_id: user.id,
          telegram_id: BigInt(input.telegramId)
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = Array.isArray(e.meta?.target) ? e.meta.target.map(String) : [];
        if (target.includes("telegram_id")) return fail("telegram_taken");
        return fail("staff_bound_other_telegram");
      }
      throw e;
    }
  }

  return { ok: true, user: dtoFrom(user, hit.slot_code, tg) };
}
