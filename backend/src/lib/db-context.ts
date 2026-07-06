import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../config/database";

/** Tranzaksiya ichidagi Prisma client. */
export type DbTransaction = Prisma.TransactionClient;

/** Root client yoki tranzaksiya — domain servislar ikkalasini ham qabul qilishi mumkin. */
export type DbExecutor = PrismaClient | DbTransaction;

/** Default singleton DB client. */
export function getDefaultDb(): PrismaClient {
  return prisma;
}

/** Bir martalik tranzaksiya — domain qatlamida `prisma.$transaction` o‘rniga. */
export function withTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
