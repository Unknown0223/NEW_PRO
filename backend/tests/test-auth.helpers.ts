import request from "supertest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../src/config/database";

/** Integratsiya testlari: sessiya limiti (max_sessions=1) bilan to‘qnashmaslik uchun. */
export async function loginForIntegrationTest(
  app: FastifyInstance,
  input: { slug: string; login: string; password: string }
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (tenant) {
    const user = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, login: input.login }
    });
    if (user) {
      await prisma.refreshToken.updateMany({
        where: { tenant_id: tenant.id, user_id: user.id, revoked_at: null },
        data: { revoked_at: new Date() }
      });
    }
  }
  return request(app.server).post("/api/auth/login").send({
    ...input,
    device_id: "vitest-integration"
  });
}
