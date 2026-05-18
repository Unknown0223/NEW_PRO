/** Zod defaultlar + `process.env.DATABASE_URL` — `PrismaClient` dan oldin. */
import "./env";
import { Prisma, PrismaClient } from "@prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const SLOW_QUERY_MS = Number.parseInt(process.env.PRISMA_SLOW_QUERY_MS ?? "100", 10);

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.PRISMA_QUERY_LOG === "1"
        ? [
            { emit: "event", level: "query" },
            "error",
            "warn"
          ]
        : ["error", "warn"]
  });

  if (process.env.PRISMA_QUERY_LOG === "1") {
    client.$on("query", (e: Prisma.QueryEvent) => {
      if (e.duration >= SLOW_QUERY_MS) {
        // eslint-disable-next-line no-console
        console.warn("[prisma.slow]", {
          ms: e.duration,
          query: e.query.slice(0, 500)
        });
      }
    });
  }

  return client;
}

export const prisma = global.__prisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
