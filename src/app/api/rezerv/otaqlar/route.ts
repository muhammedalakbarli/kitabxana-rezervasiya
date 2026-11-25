import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { roomAvailability } from "@/lib/booking-data";
import { runSweep } from "@/lib/sweep";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Giriş tələb olunur" }, { status: 401 });
  await runSweep();
  const data = await roomAvailability(req.nextUrl.searchParams.get("k") ?? "", req.nextUrl.searchParams.get("gun"), user.id);
  if (!data) return NextResponse.json({ error: "Kitabxana tapılmadı" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
