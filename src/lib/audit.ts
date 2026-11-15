import { db } from "./db";

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string | null, meta?: unknown) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId: entityId ?? null, meta: meta === undefined ? null : JSON.stringify(meta) },
    });
  } catch (e) {
    console.error("[audit]", e);
  }
}
