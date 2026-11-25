"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export type ProfileState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };

const schema = z.object({
  firstName: z.string().trim().min(2, "Adınızı daxil edin").max(40),
  lastName: z.string().trim().min(2, "Soyadınızı daxil edin").max(40),
  facultyId: z.string().min(1, "Fakültəni seçin"),
  specialty: z.string().trim().min(2, "İxtisası daxil edin").max(120),
  course: z.coerce.number({ message: "Kursu seçin" }).int().min(1, "Kursu seçin").max(6),
  groupName: z.string().trim().min(1, "Qrup nömrəsini daxil edin").max(30),
  phone: z.string().trim().max(30).optional(),
  studentNumber: z.string().trim().max(30).optional(),
});

const nameCase = (s: string) => s.replace(/\s+/g, " ").trim().replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toLocaleUpperCase("az"));

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const raw = Object.fromEntries(form.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { error: "Zəhmət olmasa qeyd olunan sahələri düzəldin.", fieldErrors };
  }
  const d = parsed.data;
  const faculty = await db.faculty.findFirst({ where: { id: d.facultyId, isActive: true } });
  if (!faculty) return { error: "Fakültə tapılmadı.", fieldErrors: { facultyId: "Fakültəni seçin" } };
  const firstName = nameCase(d.firstName);
  const lastName = nameCase(d.lastName);
  const first = !user.profileCompletedAt;
  await db.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      userType: user.userType ?? "STUDENT",
      facultyId: faculty.id,
      faculty: faculty.name,
      specialty: d.specialty,
      course: d.course,
      groupName: d.groupName.toUpperCase(),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.studentNumber !== undefined ? { studentNumber: d.studentNumber || null } : {}),
      profileCompletedAt: user.profileCompletedAt ?? new Date(),
    },
  });
  await audit(user.id, first ? "profile.completed" : "profile.updated", "User", user.id);
  revalidatePath("/", "layout");
  return { saved: true };
}
