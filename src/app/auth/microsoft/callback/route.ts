import { NextResponse, type NextRequest } from "next/server";
import { createSession, safeNext, upsertUserOnLogin } from "@/lib/auth";
import { env, isAllowedEmail, microsoftEnabled } from "@/lib/env";
import { exchangeCode, graphMe } from "@/lib/microsoft";
import { audit } from "@/lib/audit";

function fail(msg: string) {
  return NextResponse.redirect(new URL(`/giris?xeta=${encodeURIComponent(msg)}`, env.appUrl));
}

export async function GET(req: NextRequest) {
  if (!microsoftEnabled()) return fail("Microsoft girişi aktiv deyil.");
  const sp = req.nextUrl.searchParams;
  const state = req.cookies.get("ms_state")?.value;
  const verifier = req.cookies.get("ms_verifier")?.value;
  const next = safeNext(req.cookies.get("ms_next")?.value);
  if (sp.get("error")) return fail("Microsoft girişi ləğv edildi.");
  if (!state || !verifier || sp.get("state") !== state || !sp.get("code")) return fail("Giriş sessiyası etibarsızdır. Yenidən cəhd edin.");
  try {
    const token = await exchangeCode(sp.get("code")!, verifier);
    const me = await graphMe(token.access_token);
    const email = (me.mail || me.userPrincipalName || "").toLowerCase();
    if (!isAllowedEmail(email)) return fail("Yalnız universitet hesabları ilə daxil olmaq mümkündür.");
    const user = await upsertUserOnLogin(email, { name: me.displayName ?? null, externalId: me.id, department: me.department ?? null });
    await createSession(user.id);
    await audit(user.id, "auth.microsoft", "User", user.id);
    const res = NextResponse.redirect(new URL(user.profileCompletedAt ? next : `/profil?ilk=1&next=${encodeURIComponent(next)}`, env.appUrl));
    for (const c of ["ms_state", "ms_verifier", "ms_next"]) res.cookies.set(c, "", { path: "/auth/microsoft", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("[ms-callback]", e);
    return fail("Microsoft ilə giriş zamanı xəta baş verdi.");
  }
}
