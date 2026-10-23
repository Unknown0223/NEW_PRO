import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const since = process.env.SINCE ?? "2026-09-27 11:04:00+00";

async function main() {
  const q = (sql: string) => p.$queryRawUnsafe(sql);
  const t = `'${since}'::timestamptz`;
  console.log(
    JSON.stringify(
      await q(`
        SELECT 'orders' k, count(*)::int c FROM orders WHERE created_at > ${t} OR updated_at > ${t}
        UNION ALL SELECT 'clients', count(*)::int FROM clients WHERE created_at > ${t} OR updated_at > ${t}
        UNION ALL SELECT 'client_payments', count(*)::int FROM client_payments WHERE created_at > ${t}
        UNION ALL SELECT 'photos', count(*)::int FROM client_photo_reports WHERE created_at > ${t}
        UNION ALL SELECT 'refresh_logins', count(*)::int FROM refresh_tokens WHERE created_at > ${t}
      `)
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
