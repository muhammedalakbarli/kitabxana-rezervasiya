import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runSweep } from "@/lib/sweep";

/** Xarici planlaşdırıcı üçün (məs. hər dəqiqə): GET /api/cron  Header: Authorization: Bearer <CRON_SECRET> */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const key = auth?.startsWith("Bearer ") ? auth.slice(7) : req.nextUrl.searchParams.get("key");
  if (!env.cronSecret || key !== env.cronSecret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await runSweep(true);
  return NextResponse.json({ ok: true, report });
}
