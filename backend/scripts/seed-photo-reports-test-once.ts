/**
 * Bugungi sana uchun test foto-reportlar (supervisor «Фото отчёты»).
 *
 *   IMPORT_TENANT_SLUG=test1 npx tsx scripts/seed-photo-reports-test-once.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CAPTIONS = [
  "Витрина",
  "Холодильник",
  "Полка",
  "Ценник",
  "Вход в точку",
  "Склад точки",
  "POS материалы",
  "Конкуренты"
] as const;

function svgDataUrl(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 72% 48%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 40) % 360} 65% 32%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="640" cy="160" r="90" fill="rgba(255,255,255,.18)"/>
  <circle cx="180" cy="620" r="140" fill="rgba(0,0,0,.12)"/>
  <text x="50%" y="48%" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif"
    font-size="42" font-weight="700">${label}</text>
  <text x="50%" y="56%" text-anchor="middle" fill="rgba(255,255,255,.85)"
    font-family="Segoe UI,Arial,sans-serif" font-size="22">тест · фото отчёт</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const photosPerAgent = Math.max(1, Number(process.env.PHOTOS_PER_AGENT || 5));
  const today = localYmd();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true, login: true },
    orderBy: { id: "asc" },
    take: 8
  });
  if (agents.length === 0) throw new Error("Agent topilmadi");

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true, name: true, city: true },
    orderBy: { id: "asc" },
    take: 20
  });
  if (clients.length === 0) throw new Error("Client topilmadi");

  let created = 0;
  for (let a = 0; a < agents.length; a++) {
    const agent = agents[a]!;
    for (let i = 0; i < photosPerAgent; i++) {
      const client = clients[(a + i) % clients.length]!;
      const caption = CAPTIONS[i % CAPTIONS.length]!;
      const hour = 9 + ((a + i) % 8);
      const minute = (a * 13 + i * 7) % 60;
      const createdAt = new Date(
        `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
      );
      await prisma.clientPhotoReport.create({
        data: {
          tenant_id: tenant.id,
          client_id: client.id,
          created_by_user_id: agent.id,
          caption,
          image_url: svgDataUrl(caption, (a * 47 + i * 31) % 360),
          created_at: createdAt
        }
      });
      created += 1;
    }
  }

  console.log(
    `OK: tenant=${slug} date=${today} agents=${agents.length} photos=${created} (har agentga ${photosPerAgent})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
