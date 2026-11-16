/** Mühit dəyişənləri — bir yerdən oxunur. */
const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  authSecret: process.env.AUTH_SECRET ?? "dev-secret-change-me",
  allowedDomains: list(process.env.ALLOWED_EMAIL_DOMAINS ?? "qu.edu.az"),
  adminEmails: list(process.env.ADMIN_EMAILS),
  cronSecret: process.env.CRON_SECRET ?? "",
  // Vercel-də yalnız /tmp yazıla biləndir (müvəqqəti)
  storageDir: process.env.STORAGE_DIR ?? (process.env.VERCEL ? "/tmp/storage" : "./storage"),
  mailMode: (process.env.MAIL_MODE ?? "log") as "smtp" | "log",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
  },
  mailFrom: process.env.MAIL_FROM ?? "QU Kitabxana <kitabxana@qu.edu.az>",
  devMailbox: process.env.DEV_MAILBOX === "true",
  /** Təyin olunubsa /dev/poct yalnız ?key=... ilə açılır (ictimai demo üçün) */
  devMailboxKey: process.env.DEV_MAILBOX_KEY ?? "",
  ms: {
    tenantId: process.env.MS_TENANT_ID ?? "",
    clientId: process.env.MS_CLIENT_ID ?? "",
    clientSecret: process.env.MS_CLIENT_SECRET ?? "",
  },
  checkinCidrs: list(process.env.CHECKIN_ALLOWED_CIDRS),
  isProd: process.env.NODE_ENV === "production",
};

export const microsoftEnabled = () => Boolean(env.ms.tenantId && env.ms.clientId && env.ms.clientSecret);

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const m = /^[^\s@]+@([^\s@]+)$/.exec(e);
  if (!m) return false;
  return env.allowedDomains.includes(m[1]);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Ünvanın sahibi (From) e-poçtu: "Ad <a@b>" → a@b */
export function mailFromAddress(): string {
  const m = /<([^>]+)>/.exec(env.mailFrom);
  return (m ? m[1] : env.mailFrom).trim();
}
