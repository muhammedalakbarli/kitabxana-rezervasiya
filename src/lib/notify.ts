import { db } from "./db";
import { env } from "./env";
import { emailLayout, plainText } from "./email-templates";
import { queueMail } from "./mail";

export type NotifyInput = {
  type: string;
  title: string;
  body: string;
  /** Tətbiq daxilində keçid (nisbi yol) */
  link?: string;
  /** E-poçt göndərilsinmi; əlavə sətirlər və təqvim faylı */
  email?:
    | boolean
    | {
        subject?: string;
        rows?: [string, string][];
        ctaLabel?: string;
        footnote?: string;
        ics?: { method: "REQUEST" | "CANCEL"; content: string };
      };
};

/** Tətbiqdaxili bildiriş + (istəyə görə) e-poçt. Xətalar əsas axını dayandırmır. */
export async function notify(userIds: string | string[], n: NotifyInput): Promise<void> {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (!ids.length) return;
  try {
    await db.notification.createMany({
      data: ids.map((userId) => ({ userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null })),
    });
    if (!n.email) return;
    const e = typeof n.email === "object" ? n.email : {};
    const users = await db.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
    const cta = n.link ? { label: e.ctaLabel ?? "Sistemdə bax", url: `${env.appUrl}${n.link}` } : undefined;
    for (const u of users) {
      const tpl = { title: n.title, intro: n.body, rows: e.rows, cta, footnote: e.footnote };
      await queueMail({
        to: u.email,
        subject: e.subject ?? n.title,
        html: emailLayout(tpl),
        text: plainText(tpl),
        ics: e.ics,
      });
    }
  } catch (err) {
    console.error("[notify]", err);
  }
}

/** Bütün STAFF/ADMIN istifadəçilərinə */
export async function notifyStaff(n: NotifyInput) {
  const staff = await db.user.findMany({ where: { role: { in: ["STAFF", "ADMIN"] } }, select: { id: true } });
  await notify(staff.map((s) => s.id), n);
}
