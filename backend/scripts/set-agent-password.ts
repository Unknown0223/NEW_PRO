import bcrypt from "bcryptjs";
import { prisma } from "../prisma/seed/helpers";

async function main() {
  const login = process.argv[2] ?? "agent";
  const slug = process.argv[3] ?? "test1";
  const password = process.argv[4] ?? "111111";

  const password_hash = await bcrypt.hash(password, 10);
  const result = await prisma.user.updateMany({
    where: { login, tenant: { slug } },
    data: { password_hash },
  });
  console.log(`Updated ${result.count} user(s): ${slug}/${login} -> password set`);

  const row = await prisma.user.findFirst({
    where: { login, tenant: { slug } },
    select: { password_hash: true },
  });
  if (!row) {
    console.error("User not found");
    process.exit(1);
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  console.log("Verify:", ok ? "OK" : "FAIL");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
