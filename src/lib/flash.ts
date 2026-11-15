import { redirect } from "next/navigation";

/** Server action-dan sonra bildiriş mesajı ilə yönləndirmə */
export function go(path: string, msg?: { ok?: string; err?: string }): never {
  if (!msg) redirect(path);
  const [base, query = ""] = path.split("?");
  const qs = new URLSearchParams(query);
  if (msg.ok) qs.set("ok", msg.ok);
  if (msg.err) qs.set("err", msg.err);
  redirect(`${base}?${qs.toString()}`);
}
