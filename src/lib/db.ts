import { Prisma, PrismaClient } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Serializable tranzaksiya + serializasiya konfliktlərində avtomatik təkrar. */
export async function serializable<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (e: unknown) {
      lastErr = e;
      const code = (e as { code?: string })?.code;
      const msg = String((e as Error)?.message ?? "");
      if (code === "P2034" || msg.includes("could not serialize") || msg.includes("deadlock")) {
        await new Promise((r) => setTimeout(r, 30 + Math.random() * 120));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** PostgreSQL EXCLUDE (üst-üstə düşmə) xətası */
export function isOverlapError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? "");
  return msg.includes("no_overlap") || msg.includes("23P01") || msg.includes("exclusion constraint");
}
