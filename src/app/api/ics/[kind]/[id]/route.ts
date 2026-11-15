import { NextResponse } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { reservationIcs } from "@/lib/reservations";
import { buildIcs } from "@/lib/ics";
import { mailFromAddress } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Giriş tələb olunur", { status: 401 });
  let ics: string | null = null;
  if (kind === "otaq") {
    const r = await db.reservation.findUnique({ where: { id }, include: { room: { include: { library: true } }, participants: true } });
    if (r && (r.participants.some((p) => p.userId === user.id) || isStaff(user))) {
      ics = reservationIcs(r, r.room, [{ email: user.email, name: user.name }], "REQUEST").replace("METHOD:REQUEST", "METHOD:PUBLISH");
    }
  } else if (kind === "avadanliq") {
    const r = await db.equipmentReservation.findUnique({ where: { id }, include: { equipment: { include: { library: true } } } });
    if (r && (r.userId === user.id || isStaff(user))) {
      ics = buildIcs({
        uid: `avadanliq-${r.id}@kitabxana.qu.edu.az`, sequence: r.icsSequence, method: "PUBLISH", start: r.startAt, end: r.endAt,
        summary: `Kitabxana: ${r.equipment.name} (${r.equipment.assetTag})`, location: r.equipment.library.name,
        organizer: { email: mailFromAddress() }, attendees: [{ email: user.email, name: user.name }], alarmMinutes: 15,
      });
    }
  }
  if (!ics) return new NextResponse("Tapılmadı", { status: 404 });
  return new NextResponse(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="rezervasiya-${id}.ics"` },
  });
}
