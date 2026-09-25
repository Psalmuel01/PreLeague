import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { q } from "./db";

// Session helpers without any Solana/crypto libraries, so read-only routes stay light.

export const SESSION_COOKIE = "pl_session";
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** The signed-in wallet for this request, or null. */
export async function sessionWallet(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await q<{ wallet: string }>(`select wallet from sessions where token_hash = $1 and expires_at > now()`, [sha256(token)]);
  return row?.wallet ?? null;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await q(`delete from sessions where token_hash = $1`, [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

/** Shared-secret check for cron and admin endpoints. */
export function hasSecret(request: Request, envName: "CRON_SECRET" | "ADMIN_SECRET"): boolean {
  const secret = process.env[envName];
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}` || request.headers.get("x-admin-secret") === secret;
}
