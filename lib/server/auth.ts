import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { q } from "./db";
import { SESSION_COOKIE, sha256 } from "./session";

export { hasSecret, logout, sessionWallet } from "./session";

const NONCE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;

/** A base58 32-byte Solana public key. */
export function isWallet(address: unknown): address is string {
  if (typeof address !== "string" || address.length < 32 || address.length > 44) return false;
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

/** Issue a one-time sign-in message for a wallet. */
export async function createNonce(wallet: string, domain: string) {
  const nonce = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + NONCE_TTL_MS);
  const message = [
    `${domain} wants you to sign in to PreLeague with your Solana account:`,
    wallet,
    "",
    "Signing proves you own this wallet. It is free and does not send a transaction.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    `Expiration Time: ${expires.toISOString()}`,
  ].join("\n");
  await q(`insert into auth_nonces (nonce, wallet, message, expires_at) values ($1, $2, $3, $4)`, [nonce, wallet, message, expires]);
  return { nonce, message };
}

/** Verify a signed nonce and start a session. Returns an error message on failure. */
export async function verifyAndLogin(wallet: string, nonce: string, signature: string): Promise<string | null> {
  const [row] = await q<{ message: string; wallet: string; expires_at: Date; used_at: Date | null }>(
    `update auth_nonces set used_at = now() where nonce = $1 and used_at is null returning message, wallet, expires_at, used_at`,
    [nonce],
  );
  if (!row) return "Sign-in request not found or already used";
  if (row.wallet !== wallet) return "Wallet does not match the sign-in request";
  if (row.expires_at.getTime() < Date.now()) return "Sign-in request expired";
  let ok = false;
  try {
    ok = nacl.sign.detached.verify(new TextEncoder().encode(row.message), bs58.decode(signature), bs58.decode(wallet));
  } catch {
    ok = false;
  }
  if (!ok) return "Signature is not valid for this wallet";

  const token = randomBytes(32).toString("base64url");
  await q(`insert into sessions (token_hash, wallet, expires_at) values ($1, $2, $3)`, [sha256(token), wallet, new Date(Date.now() + SESSION_TTL_MS)]);
  await q(`insert into profiles (wallet) values ($1) on conflict (wallet) do nothing`, [wallet]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return null;
}
