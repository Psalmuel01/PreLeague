import { isWallet, verifyAndLogin } from "@/lib/server/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { wallet?: unknown; nonce?: unknown; signature?: unknown };
  if (!isWallet(body.wallet) || typeof body.nonce !== "string" || typeof body.signature !== "string") {
    return Response.json({ error: "wallet, nonce and signature are required" }, { status: 400 });
  }
  const error = await verifyAndLogin(body.wallet, body.nonce, body.signature);
  if (error) return Response.json({ error }, { status: 401 });
  return Response.json({ wallet: body.wallet });
}
