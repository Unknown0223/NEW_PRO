import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const tables = await p.$queryRawUnsafe(
    "SELECT count(*)::int AS c FROM information_schema.tables WHERE table_schema='public'"
  );
  const clients = await p.client.count();
  const orders = await p.order.count();
  const payments = await p.payment.count();
  const photos = await p.clientPhotoReport.count();
  const users = await p.user.count();
  const products = await p.product.count();
  console.log(
    JSON.stringify(
      {
        tables: (tables as { c: number }[])[0]!.c,
        clients,
        orders,
        payments,
        photos,
        users,
        products
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
