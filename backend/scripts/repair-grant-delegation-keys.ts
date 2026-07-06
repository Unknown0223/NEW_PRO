/**
 * Noto‘g‘ri nested `access.grant.access.grant.*` kalitlarini tozalash va
 * to‘g‘ri bir darajali `access.grant.<operation>` ga qayta yozish.
 */
import { prisma } from "../src/config/database";
import {
  isGrantDelegationKey,
  normalizeGrantDelegationOperationKey,
  toGrantDelegationKey
} from "../src/modules/access/access-grant-delegation";

async function main() {
  const tenantId = 1;
  const badPerms = await prisma.permission.findMany({
    where: { tenant_id: tenantId, key: { startsWith: "access.grant." } },
    select: { id: true, key: true }
  });

  let deletedLinks = 0;
  let deletedPerms = 0;
  const canonicalByOp = new Map<string, number>();

  for (const p of badPerms) {
    const op = normalizeGrantDelegationOperationKey(p.key);
    if (!op || op.startsWith("access.grant.")) {
      const n = await prisma.userPermission.deleteMany({ where: { permission_id: p.id } });
      deletedLinks += n.count;
      await prisma.permission.delete({ where: { id: p.id } }).catch(() => undefined);
      deletedPerms += 1;
      continue;
    }
    const canonicalKey = toGrantDelegationKey(op);
    if (p.key !== canonicalKey) {
      const n = await prisma.userPermission.deleteMany({ where: { permission_id: p.id } });
      deletedLinks += n.count;
      await prisma.permission.delete({ where: { id: p.id } }).catch(() => undefined);
      deletedPerms += 1;
    }
  }

  const user2090Links = await prisma.userPermission.findMany({
    where: {
      user_id: 2090,
      effect: "allow",
      permission: { tenant_id: tenantId, key: { startsWith: "access.grant." } }
    },
    select: { permission: { select: { key: true } } }
  });

  const ops = new Set<string>();
  for (const link of user2090Links) {
    const op = normalizeGrantDelegationOperationKey(link.permission.key);
    if (op && !isGrantDelegationKey(op)) ops.add(op);
  }

  for (const op of ops) {
    const canonicalKey = toGrantDelegationKey(op);
    let pid = canonicalByOp.get(op);
    if (pid == null) {
      const perm = await prisma.permission.upsert({
        where: { tenant_id_key: { tenant_id: tenantId, key: canonicalKey } },
        create: { tenant_id: tenantId, key: canonicalKey, module: "access" },
        update: {}
      });
      pid = perm.id;
      canonicalByOp.set(op, pid);
    }
    await prisma.userPermission.deleteMany({ where: { user_id: 2090, permission_id: pid } });
    await prisma.userPermission.create({
      data: { user_id: 2090, permission_id: pid, effect: "allow" }
    });
  }

  console.log("deleted bad permission rows", deletedPerms, "user links", deletedLinks);
  console.log("user 2090 canonical delegation ops", ops.size);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
