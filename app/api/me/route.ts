import type { CompanyId } from "@/lib/companies";
import type { HistoryJSON, LeagueStatus, MeJSON } from "@/lib/api-types";
import { sessionWallet } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { avatarTone, displayName } from "@/lib/server/views";

// GET /api/me → signed-in wallet, display name and every league you entered.
export async function GET() {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ wallet: null, displayName: null, history: [] } satisfies MeJSON);
  const [profile] = await q<{ display_name: string | null }>(`select display_name from profiles where wallet = $1`, [wallet]);
  const rows = await q<{
    league_id: string;
    series: string;
    round: number;
    status: LeagueStatus;
    starts_at: Date;
    ends_at: Date;
    picks: CompanyId[];
    locked_at: Date;
    rank: number | null;
    score: number | null;
    pick_returns: number[] | null;
    managers: string;
    winner_wallet: string | null;
    winner_name: string | null;
    winner_score: number | null;
    prize_symbol: CompanyId;
    prize_usd: string;
    claim: "pending" | "sent" | "failed" | null;
  }>(
    `select l.id as league_id, l.series, l.round, l.status, l.starts_at, l.ends_at, e.picks, e.locked_at,
            r.rank, r.score, r.pick_returns,
            (select count(*) from entries x where x.league_id = l.id) as managers,
            l.winner_wallet, wp.display_name as winner_name, wr.score as winner_score,
            l.prize_symbol, l.prize_usd, pc.status as claim
     from entries e
     join leagues l on l.id = e.league_id
     left join results r on r.league_id = l.id and r.wallet = e.wallet
     left join profiles wp on wp.wallet = l.winner_wallet
     left join results wr on wr.league_id = l.id and wr.wallet = l.winner_wallet
     left join prize_claims pc on pc.league_id = l.id and pc.wallet = e.wallet
     where e.wallet = $1
     order by l.starts_at desc`,
    [wallet],
  );
  const history: HistoryJSON[] = rows.map((r) => {
    const winnerName = r.winner_wallet ? displayName(r.winner_wallet, r.winner_name) : null;
    return {
      leagueId: r.league_id,
      series: r.series,
      round: r.round,
      status: r.status,
      startsAt: r.starts_at.getTime(),
      endsAt: r.ends_at.getTime(),
      picks: r.picks,
      lockedAt: r.locked_at.getTime(),
      rank: r.rank,
      score: r.score,
      pickReturns: r.pick_returns,
      managers: Number(r.managers),
      winner:
        r.winner_wallet && winnerName && r.winner_score !== null
          ? {
              name: winnerName,
              initials: winnerName.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase(),
              avatar: r.winner_wallet === wallet ? "av-you" : avatarTone(r.winner_wallet),
              you: r.winner_wallet === wallet,
              score: r.winner_score,
            }
          : null,
      prize: { company: r.prize_symbol, usd: Number(r.prize_usd) },
      claim: r.claim,
    };
  });
  return Response.json({ wallet, displayName: profile?.display_name ?? null, history } satisfies MeJSON, {
    headers: { "cache-control": "no-store" },
  });
}

// POST /api/me { displayName }
export async function POST(request: Request) {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet first" }, { status: 401 });
  const { displayName: raw } = (await request.json().catch(() => ({}))) as { displayName?: unknown };
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ").slice(0, 20) : "";
  await q(
    `insert into profiles (wallet, display_name) values ($1, $2) on conflict (wallet) do update set display_name = excluded.display_name`,
    [wallet, name || null],
  );
  return Response.json({ ok: true, displayName: name || null });
}
