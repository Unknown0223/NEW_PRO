/**
 * Lokal «Отчёт по задачам» review uchun tenant_tasks seed (idempotent TASK-SEED-*).
 *
 *   npx tsx scripts/seed-tasks-report-demo.ts
 *   IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-tasks-report-demo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIX = "TASK-SEED-";

type SeedSpec = {
  title: string;
  description: string;
  status: string;
  priority: string;
  task_type_ref: string;
  daysAgo: number;
  dueInDays: number | null;
  withClient: boolean;
  completed: boolean;
  result_comment: string | null;
  photo_count: number;
  assigneeIndex: number;
  clientIndex: number;
};

const SPECS: SeedSpec[] = [
  {
    title: `${PREFIX}Визит в торговую точку`,
    description: "Проверить выкладку и остатки на полке",
    status: "open",
    priority: "normal",
    task_type_ref: "visit",
    daysAgo: 0,
    dueInDays: 2,
    withClient: true,
    completed: false,
    result_comment: null,
    photo_count: 0,
    assigneeIndex: 0,
    clientIndex: 0
  },
  {
    title: `${PREFIX}Собрать фотоотчёт по полке`,
    description: "Сделать 3 фото: вход, стеллаж, ценники",
    status: "in_progress",
    priority: "high",
    task_type_ref: "photo",
    daysAgo: 1,
    dueInDays: 1,
    withClient: true,
    completed: false,
    result_comment: null,
    photo_count: 0,
    assigneeIndex: 0,
    clientIndex: 1
  },
  {
    title: `${PREFIX}Проверка оборудования`,
    description: "Холодильник работает? температура ок?",
    status: "done",
    priority: "normal",
    task_type_ref: "check",
    daysAgo: 3,
    dueInDays: -1,
    withClient: true,
    completed: true,
    result_comment: "Температура −18, замечаний нет",
    photo_count: 2,
    assigneeIndex: 1,
    clientIndex: 0
  },
  {
    title: `${PREFIX}Долг клиента — уточнить оплату`,
    description: "Позвонить, согласовать дату оплаты",
    status: "open",
    priority: "high",
    task_type_ref: "call",
    daysAgo: 2,
    dueInDays: 0,
    withClient: true,
    completed: false,
    result_comment: null,
    photo_count: 0,
    assigneeIndex: 1,
    clientIndex: 2
  },
  {
    title: `${PREFIX}Обучение нового агента`,
    description: "Маршрут + мобильное приложение",
    status: "in_progress",
    priority: "low",
    task_type_ref: "other",
    daysAgo: 5,
    dueInDays: 7,
    withClient: false,
    completed: false,
    result_comment: null,
    photo_count: 0,
    assigneeIndex: 0,
    clientIndex: 0
  },
  {
    title: `${PREFIX}Возврат с полки — акт`,
    description: "Оформить акт на просрочку",
    status: "done",
    priority: "high",
    task_type_ref: "return",
    daysAgo: 7,
    dueInDays: -2,
    withClient: true,
    completed: true,
    result_comment: "Акт №demo, 4 позиции",
    photo_count: 1,
    assigneeIndex: 0,
    clientIndex: 1
  },
  {
    title: `${PREFIX}Отменённый выезд`,
    description: "Клиент закрыт на инвентаризацию",
    status: "cancelled",
    priority: "normal",
    task_type_ref: "visit",
    daysAgo: 4,
    dueInDays: null,
    withClient: true,
    completed: false,
    result_comment: "Клиент попросил перенести",
    photo_count: 0,
    assigneeIndex: 1,
    clientIndex: 2
  },
  {
    title: `${PREFIX}Срочный заказ — подтвердить`,
    description: "Сверить количество перед отгрузкой",
    status: "open",
    priority: "high",
    task_type_ref: "order",
    daysAgo: 0,
    dueInDays: 0,
    withClient: true,
    completed: false,
    result_comment: null,
    photo_count: 0,
    assigneeIndex: 0,
    clientIndex: 0
  }
];

function daysShift(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function fakePhotos(n: number): string[] | null {
  if (n <= 0) return null;
  return Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,seed${i}`);
}

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "aksit").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const deleted = await prisma.tenantTask.deleteMany({
    where: { tenant_id: tenant.id, title: { startsWith: PREFIX } }
  });

  const admin = await prisma.user.findFirst({
    where: { tenant_id: tenant.id, login: "admin" },
    select: { id: true, name: true }
  });
  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 5
  });
  const clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, merged_into_client_id: null, is_active: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 5
  });

  while (clients.length < 3) {
    const n = clients.length + 1;
    const created = await prisma.client.create({
      data: {
        tenant_id: tenant.id,
        name: `TASK-SEED Demo TT ${n}`,
        phone: `90110000${n}`,
        address: `Demo street ${n}`,
        city: "Andijon",
        is_active: true
      },
      select: { id: true, name: true }
    });
    clients.push(created);
  }

  const assigneePool = agents.length ? agents : admin ? [admin] : [];
  const creatorId = admin?.id ?? assigneePool[0]?.id ?? null;
  const now = new Date();
  let inserted = 0;

  for (const spec of SPECS) {
    const assignee = assigneePool[spec.assigneeIndex % Math.max(assigneePool.length, 1)];
    const client = clients[spec.clientIndex % clients.length];
    const createdAt = daysShift(now, -spec.daysAgo);
    const dueAt = spec.dueInDays == null ? null : daysShift(now, spec.dueInDays);
    const completedAt = spec.completed ? daysShift(createdAt, 1) : null;

    await prisma.tenantTask.create({
      data: {
        tenant_id: tenant.id,
        title: spec.title,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        task_type_ref: spec.task_type_ref,
        assignee_user_id: assignee?.id ?? null,
        created_by_user_id: creatorId,
        client_id: spec.withClient ? (client?.id ?? null) : null,
        due_at: dueAt,
        started_at:
          spec.status === "in_progress" || spec.completed ? daysShift(createdAt, 0) : null,
        completed_at: completedAt,
        result_comment: spec.result_comment,
        result_photos: fakePhotos(spec.photo_count) ?? undefined,
        created_at: createdAt
      }
    });
    inserted += 1;
  }

  console.log(
    JSON.stringify({
      slug,
      tenant_id: tenant.id,
      deleted_prior: deleted.count,
      inserted,
      assignees: assigneePool.map((a) => a.name),
      clients: clients.map((c) => c.name),
      creator_user_id: creatorId
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
