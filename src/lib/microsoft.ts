/**
 * Microsoft 365 / Entra ID ilə giriş (OAuth 2.0 Authorization Code + PKCE).
 * Rəqəmsal şöbə Entra ID-də tətbiq qeydiyyatı yaradıb MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET
 * dəyərlərini .env-ə yazdıqda avtomatik aktivləşir. Redirect URI: {APP_URL}/auth/microsoft/callback
 *
 * İstifadəçi məlumatı Microsoft Graph /me endpoint-indən alınır (token Graph tərəfindən yoxlanılır).
 */
import crypto from "node:crypto";
import { env } from "./env";

export const MS_SCOPES = "openid profile email offline_access User.Read";

export function redirectUri() {
  return `${env.appUrl}/auth/microsoft/callback`;
}

export function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(state: string, challenge: string) {
  const u = new URL(`https://login.microsoftonline.com/${env.ms.tenantId}/oauth2/v2.0/authorize`);
  u.searchParams.set("client_id", env.ms.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", MS_SCOPES);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("prompt", "select_account");
  if (env.allowedDomains[0]) u.searchParams.set("domain_hint", env.allowedDomains[0]);
  return u.toString();
}

export async function exchangeCode(code: string, verifier: string): Promise<{ access_token: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${env.ms.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.ms.clientId,
      client_secret: env.ms.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
      scope: MS_SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`Token mübadiləsi uğursuz oldu (${res.status})`);
  return res.json();
}

export type GraphProfile = {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
  department?: string | null;
  jobTitle?: string | null;
};

export async function graphMe(accessToken: string): Promise<GraphProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,department,jobTitle", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph profili alınmadı (${res.status})`);
  return res.json();
}
