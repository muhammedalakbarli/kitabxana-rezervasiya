"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, safeNext } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export type ProfileState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

const base = z.object({
  name: z.string().trim().min(3, "Ad və soyadınızı daxil edin").max(80),
  userType: z.enum(["STUDENT", "ACADEMIC", "EMPLOYEE"], { message: "Statusunuzu seçin" }),
  phone: z.string().trim().max(30).optional(),
});
const student = z.object({
  faculty: z.string().trim().min(2, "Fakültəni daxil edin").max(120),
  specialty: z.string().trim().min(2, "İxtisası daxil edin").max(120),
  groupName: z.string().trim().min(1, "Qrupu daxil edin").max(30),
  course: z.coerce.number({ message: "Kursu seçin" }).int().min(1, "Kursu seçin").max(6),
  studentNumber: z.string().trim().max(30).optional(),
});
const staff = z.object({ department: z.string().trim().min(2, "Struktur bölməni daxil edin").max(120) });

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser({ allowIncompleteProfile: true });
  const raw = Object.fromEntries(form.entries());
  const b = base.safeParse(raw);
  const fieldErrors: Record<string, string> = {};
  if (!b.success) for (const i of b.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  const isStudent = raw.userType === "STUDENT";
  const extra = isStudent ? student.safeParse(raw) : staff.safeParse(raw);
  if (!extra.success) for (const i of extra.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
  if (!b.success || !extra.success) return { error: "Zəhmət olmasa qeyd olunan sahələri düzəldin.", fieldErrors };

  const s = isStudent ? (extra.data as z.infer<typeof student>) : null;
  const d = !isStudent ? (extra.data as z.infer<typeof staff>) : null;
  const first = !user.profileCompletedAt;
  await db.user.update({
    where: { id: user.id },
    data: {
      name: b.data.name,
      userType: b.data.userType,
      phone: b.data.phone || null,
      faculty: s?.faculty ?? null,
      specialty: s?.specialty ?? null,
      groupName: s?.groupName ?? null,
      course: s?.course ?? null,
      studentNumber: s?.studentNumber || null,
      department: d?.department ?? null,
      profileCompletedAt: user.profileCompletedAt ?? new Date(),
    },
  });
  await audit(user.id, first ? "profile.completed" : "profile.updated", "User", user.id);
  if (first) redirect(safeNext(String(form.get("next") ?? ""), "/panel") + "?ok=" + encodeURIComponent("Profiliniz yadda saxlanıldı. Xoş gəlmisiniz!"));
  return { saved: true };
}
