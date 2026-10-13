import { sessionWallet } from "@/lib/server/session";
import { prepareClaim, recordClaim } from "@/lib/server/prize";
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet first" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const body = await request.json().catch(() => ({}));
    return Response.json(body.signature ? await recordClaim(id, wallet, body.signature) : await prepareClaim(id, wallet));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
