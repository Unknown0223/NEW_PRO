/**
 * Aksit «Фотоотчёты» uchun ko‘rinadigan JPEG namuna rasmlar.
 *
 *   IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-photo-reports-demo-jpeg.ts
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
  "Склад точки"
] as const;

const DEMO_NOTE = "PHOTO-DEMO-JPEG";

async function jpegDataUrl(label: string, hue: number): Promise<string> {
  const sharp = (await import("sharp")).default;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 42%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 50) % 360} 60% 28%)"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="48" y="48" width="864" height="624" rx="24" fill="rgba(0,0,0,0.18)"/>
  <text x="50%" y="46%" text-anchor="middle" fill="#fff"
    font-family="Arial,sans-serif" font-size="56" font-weight="700">${label}</text>
  <text x="50%" y="56%" text-anchor="middle" fill="rgba(255,255,255,0.9)"
    font-family="Arial,sans-serif" font-size="28">намуна · фотоотчёт</text>
</svg>`
  );
  const buf = await sharp(svg).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  const slug = (process.env.IMPORT_TENANT_SLUG || "aksit").trim();
  const perAgent = Math.max(3, Number(process.env.PHOTOS_PER_AGENT || 6));
  const today = localYmd();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);

  // Eski demo / svg seedlarni tozalash (captionlardan + note)
  const deleted = await prisma.clientPhotoReport.deleteMany({
    where: {
      tenant_id: tenant.id,
      OR: [
        { caption: { in: [...CAPTIONS] } },
        { image_url: { startsWith: "data:image/svg" } },
        { image_url: { contains: DEMO_NOTE } }
      ]
    }
  });

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenant.id, role: "agent", is_active: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 3
  });
  if (agents.length === 0) throw new Error("Agent topilmadi");

  const clients = await prisma.client.findMany({
    where: { tenant_id: tenant.id, merged_into_client_id: null },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: 12
  });
  if (clients.length === 0) throw new Error("Client topilmadi");

  let created = 0;
  for (let a = 0; a < agents.length; a++) {
    const agent = agents[a]!;
    for (let i = 0; i < perAgent; i++) {
      const client = clients[(a * 2 + i) % clients.length]!;
      const caption = CAPTIONS[i % CAPTIONS.length]!;
      const hue = (a * 55 + i * 37) % 360;
      const image_url = await jpegDataUrl(caption, hue);
      // marker for re-run cleanup (stored inside unused path — keep in caption suffix)
      const hour = 9 + (i % 8);
      const minute = (a * 11 + i * 5) % 60;
      await prisma.clientPhotoReport.create({
        data: {
          tenant_id: tenant.id,
          client_id: client.id,
          created_by_user_id: agent.id,
          caption: `${caption}`,
          image_url,
          created_at: new Date(
            `${today}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
          )
        }
      });
      created += 1;
    }
  }

  console.log(
    JSON.stringify({
      slug,
      deleted: deleted.count,
      created,
      agents: agents.length,
      perAgent,
      date: today
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
