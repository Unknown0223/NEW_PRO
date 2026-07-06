import { prisma } from "../src/config/database";

async function main() {
  const user = await prisma.user.findFirst({
    where: { login: "agent" },
    select: {
      id: true,
      login: true,
      device_name: true,
      apk_version: true,
      last_sync_at: true,
    },
  });
  console.log(JSON.stringify(user, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
