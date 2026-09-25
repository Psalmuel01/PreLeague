import { after } from "next/server";
import { sessionWallet } from "@/lib/server/session";
import { getLeague, seriesDef, seriesRounds, maybeTick } from "@/lib/server/rounds";
import { roundView } from "@/lib/server/views";

// GET /api/series/:slug?which=current|next|last|<leagueId>
//   current = the live round, else the next open one (default)
export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  after(() => maybeTick());
  const { slug } = await ctx.params;
  if (!seriesDef(slug)) return Response.json({ error: "Unknown league" }, { status: 404 });
  const which = new URL(request.url).searchParams.get("which") ?? "current";
  const [{ live, next, last }, viewer] = await Promise.all([seriesRounds(slug), sessionWallet()]);
  const league =
    which === "current" ? live ?? next : which === "next" ? next : which === "last" ? last : which === "live" ? live : await getLeague(which);
  if (league && league.series !== slug) return Response.json({ error: "Round not in this league" }, { status: 404 });
  return Response.json(
    { round: league ? await roundView(league, viewer) : null, liveId: live?.id ?? null, nextId: next?.id ?? null, lastId: last?.id ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
