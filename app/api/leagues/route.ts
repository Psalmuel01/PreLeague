import { LEAGUES } from "@/lib/leagues";
import type { RoundSummary, SeriesJSON } from "@/lib/api-types";
import { sessionWallet } from "@/lib/server/auth";
import { seriesRounds, type LeagueRow } from "@/lib/server/rounds";
import { roundView } from "@/lib/server/views";

async function summary(row: LeagueRow | null, viewer: string | null): Promise<RoundSummary | null> {
  if (!row) return null;
  const v = await roundView(row, viewer);
  return {
    id: v.id,
    round: v.round,
    status: v.status,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    managers: v.managers.length,
    joined: Boolean(v.entry),
    leaders: (v.standings ?? []).slice(0, 3).map((s) => ({ name: s.name, initials: s.initials, avatar: s.avatar, you: s.you, portfolioReturn: s.portfolioReturn })),
  };
}

export async function GET() {
  const viewer = await sessionWallet();
  const out: SeriesJSON[] = [];
  for (const def of LEAGUES) {
    const { live, next, last } = await seriesRounds(def.slug);
    out.push({ slug: def.slug, live: await summary(live, viewer), next: await summary(next, viewer), last: await summary(last, viewer) });
  }
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
