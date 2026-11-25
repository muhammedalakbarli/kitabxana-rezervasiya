import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAllowedEmail, normalizeEmail } from "@/lib/env";
import { COURSE_LABEL } from "@/lib/analytics";

/**
 * Dəvət üçün tələbə axtarışı — YALNIZ tam e-poçt dəqiq uyğun gəldikdə nəticə qaytarır.
 * Siyahı, hissəvi axtarış və ya avtomatik tamamlama yoxdur (məxfilik). Sorğu sayı məhdudlaşdırılır.
 */
const hits = new Map<string, number[]>();
const LIMIT = 30;

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
  const now = Date.now();
  const list = (hits.get(me.id) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= LIMIT) return NextResponse.json({ error: "Çox sayda sorğu. Bir az gözləyin." }, { status: 429 });
  list.push(now);
  hits.set(me.id, list);

  const email = normalizeEmail(req.nextUrl.searchParams.get("email") ?? "");
  if (!isAllowedEmail(email)) return NextResponse.json({ found: false, reason: "invalid" });
  if (email === me.email) return NextResponse.json({ found: false, reason: "self" });
  const u = await db.user.findUnique({ where: { email }, select: { name: true, faculty: true, course: true, groupName: true, profileCompletedAt: true, blockedAt: true } });
  if (!u || !u.profileCompletedAt) return NextResponse.json({ found: false, reason: "not-registered" });
  if (u.blockedAt) return NextResponse.json({ found: false, reason: "blocked" });
  return NextResponse.json({
    found: true,
    name: u.name,
    detail: [u.faculty, u.course ? COURSE_LABEL(u.course) : null, u.groupName].filter(Boolean).join(" · "),
  }, { headers: { "Cache-Control": "no-store" } });
}
