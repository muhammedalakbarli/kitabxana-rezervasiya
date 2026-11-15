import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { env } from "./env";

/**
 * Outbox modeli: hər məktub əvvəlcə EmailLog-a yazılır, sonra göndərilir.
 * Uğursuz göndərmələr fon tapşırığı (sweep) tərəfindən təkrar cəhd edilir.
 * MAIL_MODE=log olduqda məktublar yalnız jurnala yazılır (inkişaf mühiti).
 */
let transporter: Transporter | null = null;
function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  ics?: { method: "REQUEST" | "CANCEL" | "PUBLISH"; content: string };
};

export async function queueMail(m: MailInput, opts: { await?: boolean } = {}): Promise<string> {
  const row = await db.emailLog.create({
    data: {
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text ?? null,
      ics: m.ics?.content ?? null,
      icsMethod: m.ics?.method ?? null,
      status: "PENDING",
    },
  });
  const p = deliver(row.id).catch((e) => console.error("[mail]", e));
  if (opts.await) await p;
  return row.id;
}

export async function deliver(id: string): Promise<void> {
  const m = await db.emailLog.findUnique({ where: { id } });
  if (!m || m.status === "SENT" || m.status === "LOGGED") return;
  if (env.mailMode !== "smtp") {
    await db.emailLog.update({ where: { id }, data: { status: "LOGGED", attempts: { increment: 1 }, sentAt: new Date() } });
    if (!env.isProd) console.info(`[mail:log] → ${m.to} | ${m.subject}`);
    return;
  }
  try {
    await getTransport().sendMail({
      from: env.mailFrom,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text ?? undefined,
      icalEvent: m.ics ? { method: m.icsMethod ?? "REQUEST", content: m.ics, filename: "rezervasiya.ics" } : undefined,
    });
    await db.emailLog.update({ where: { id }, data: { status: "SENT", attempts: { increment: 1 }, sentAt: new Date(), error: null } });
  } catch (e) {
    await db.emailLog.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, error: String((e as Error).message).slice(0, 500) },
    });
  }
}

/** Fon tapşırığı: ilişib qalmış və ya uğursuz məktubları təkrar göndər */
export async function retryMail(): Promise<number> {
  const now = Date.now();
  const rows = await db.emailLog.findMany({
    where: {
      OR: [
        { status: "PENDING", createdAt: { lt: new Date(now - 60_000) } },
        { status: "FAILED", attempts: { lt: 5 }, createdAt: { gt: new Date(now - 24 * 3600_000) } },
      ],
    },
    take: 20,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const r of rows) await deliver(r.id);
  return rows.length;
}
