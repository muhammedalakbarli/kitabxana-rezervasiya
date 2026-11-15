import type { Metadata } from "next";
import { Bell, CheckCheck } from "lucide-react";
import { markAllReadAction, openNotificationAction } from "@/app/actions/reservations";
import { SubmitButton } from "@/components/submit-button";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/time";

export const metadata: Metadata = { title: "Bildirişlər" };

export default async function NotificationsPage() {
  const user = await requireUser({ next: "/bildirisler" });
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Bildirişlər"
        subtitle={unread ? `${unread} oxunmamış bildiriş` : "Bütün bildirişlər oxunub"}
        actions={unread ? <form action={markAllReadAction}><SubmitButton variant="secondary" size="sm"><CheckCheck className="size-4" /> Hamısını oxunmuş et</SubmitButton></form> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell />} title="Bildiriş yoxdur" text="Rezervasiya, dəvət və növbə ilə bağlı bildirişlər burada görünəcək." />
      ) : (
        <Card className="divide-y divide-brand-100 overflow-hidden">
          {items.map((n) => (
            <form key={n.id} action={openNotificationAction}>
              <input type="hidden" name="id" value={n.id} />
              <button className={cx("flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-brand-50/60", !n.readAt && "bg-cream/30")}>
                <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={cx("text-sm text-brand-900", !n.readAt && "font-semibold")}>{n.title}</span>
                    <span className="text-xs text-brand-900/45" title={fmtDateTime(n.createdAt)}>{fmtRelative(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-brand-900/70">{n.body}</span>
                </span>
              </button>
            </form>
          ))}
        </Card>
      )}
    </div>
  );
}
