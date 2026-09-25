import { sessionWallet } from "@/lib/server/session";
import { getLeague } from "@/lib/server/rounds";
import { roundView } from "@/lib/server/views";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const league = await getLeague(id);
  if (!league) return Response.json({ error: "League not found" }, { status: 404 });
  return Response.json(await roundView(league, await sessionWallet()), { headers: { "cache-control": "no-store" } });
}
