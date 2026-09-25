import { createNonce, isWallet } from "@/lib/server/auth";

export async function POST(request: Request) {
  const { wallet } = (await request.json().catch(() => ({}))) as { wallet?: unknown };
  if (!isWallet(wallet)) return Response.json({ error: "A valid Solana wallet address is required" }, { status: 400 });
  return Response.json(await createNonce(wallet, new URL(request.url).host));
}
