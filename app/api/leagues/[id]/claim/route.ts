import { sessionWallet } from "@/lib/server/session";
import { claimPrize } from "@/lib/server/prize";

// POST /api/leagues/:id/claim — winner only; sends the prize (network per NEXT_PUBLIC_PRIZE_NETWORK).
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet first" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await claimPrize(id, wallet);
  return Response.json(result, { status: result.status === "failed" ? 400 : result.status === "pending" ? 202 : 200 });
}
