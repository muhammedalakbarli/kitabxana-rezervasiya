import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { microsoftEnabled, env } from "@/lib/env";
import { authorizeUrl, pkce } from "@/lib/microsoft";
import { safeNext } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!microsoftEnabled()) return NextResponse.redirect(new URL("/giris", env.appUrl));
  const state = crypto.randomBytes(16).toString("base64url");
  const { verifier, challenge } = pkce();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  const opts = { httpOnly: true, secure: env.appUrl.startsWith("https://"), sameSite: "lax" as const, path: "/auth/microsoft", maxAge: 600 };
  res.cookies.set("ms_state", state, opts);
  res.cookies.set("ms_verifier", verifier, opts);
  res.cookies.set("ms_next", safeNext(req.nextUrl.searchParams.get("next")), opts);
  return res;
}
