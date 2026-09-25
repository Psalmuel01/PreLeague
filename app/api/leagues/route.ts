import { after } from "next/server";
import type { RoundSummary, SeriesJSON } from "@/lib/api-types";
import { sessionWallet } from "@/lib/server/session";
import { q } from "@/lib/server/db";
import { allSeriesRounds, maybeTick, type LeagueRow } from "@/lib/server/rounds";
import { roundView } from "@/lib/server/views";

// Every series with its live / next / last round. Counts come from one query;
// full standings are only built for live rounds (for the "leading now" rows).
export async function GET() {
  after(() => maybeTick());
  const [viewer, series] = await Promise.all([sessionWallet(), allSeriesRounds()]);
  const rows = series.flatMap((s) => [s.live, s.next, s.last]).filter((r): r is LeagueRow => Boolean(r));
  const ids = [...new Set(rows.map((r) => r.id))];
  const [counts, liveViews] = await Promise.all([
    q<{ league_id: string; managers: number; joined: boolean }>(
      `select league_id, count(*)::int as managers, bool_or(wallet = $2) as joined
       from entries where league_id = any($1) group by league_id`,
      [ids, viewer ?? ""],
    ),
    Promise.all(series.filter((s) => s.live).map((s) => roundView(s.live!, viewer))),
  ]);
  const byId = new Map(counts.map((c) => [c.league_id, c]));
  const leaders = new Map(
    liveViews.map((v) => [
      v.id,
      (v.standings ?? []).slice(0, 3).map((s) => ({ name: s.name, initials: s.initials, avatar: s.avatar, you: s.you, portfolioReturn: s.portfolioReturn })),
    ]),
  );
  const summary = (r: LeagueRow | null): RoundSummary | null =>
    r && {
      id: r.id,
      round: r.round,
      status: r.status,
      startsAt: r.starts_at.getTime(),
      endsAt: r.ends_at.getTime(),
      managers: byId.get(r.id)?.managers ?? 0,
      joined: byId.get(r.id)?.joined ?? false,
      leaders: leaders.get(r.id) ?? [],
    };
  const out: SeriesJSON[] = series.map((s) => ({ slug: s.slug, live: summary(s.live), next: summary(s.next), last: summary(s.last) }));
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}
