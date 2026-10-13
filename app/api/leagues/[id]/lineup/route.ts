import { sessionWallet } from "@/lib/server/session";
import { q } from "@/lib/server/db";
import { getLeague } from "@/lib/server/rounds";
import { assertDevnet, vaultConnection, readVault } from "@/lib/solana/vault";
import { prizeAuthorityAddress } from "@/lib/server/prize";
import { validatePicks } from "@/lib/settlement";

// POST /api/leagues/:id/lineup { picks: [id, id, id] }
// Creates or replaces your lineup. Rejected once the league has kicked off.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const wallet = await sessionWallet();
  if (!wallet) return Response.json({ error: "Sign in with your wallet first" }, { status: 401 });
  const { id } = await ctx.params;
  const league = await getLeague(id);
  if (!league) return Response.json({ error: "League not found" }, { status: 404 });
  if (league.status !== "upcoming" || league.starts_at.getTime() <= Date.now()) {
    return Response.json({ error: "Lineups are locked — this league has already started" }, { status: 409 });
  }
  const { picks } = (await request.json().catch(() => ({}))) as { picks?: unknown };
  const invalid = validatePicks(picks, league.pool, league.picks_required);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  if (process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID) {
    try {
      const connection = vaultConnection(); await assertDevnet(connection);
      const state = await readVault(connection, id);
      if (!state?.funded || state.cancelled || state.finalized || state.mint !== league.prize_mint || state.authority !== prizeAuthorityAddress().toBase58()) return Response.json({ error: "Prize escrow is not funded yet — try the next round" }, { status: 409 });
    } catch {
      return Response.json({ error: "Prize escrow could not be verified — try again shortly" }, { status: 503 });
    }
  }

  // Capacity check and upsert in one statement; the kick-off check is repeated in SQL to close the race.
  const rows = await q<{ id: string }>(
    `insert into entries (league_id, wallet, picks, locked_at)
     select $1::text, $2::text, $3::text[], now()
     from leagues l
     where l.id = $1 and l.status = 'upcoming' and l.starts_at > now()
       and (exists (select 1 from entries where league_id = $1 and wallet = $2)
            or (select count(*) from entries where league_id = $1) < l.max_players)
     on conflict (league_id, wallet) do update set picks = excluded.picks, locked_at = now()
     returning id`,
    [id, wallet, picks],
  );
  if (rows.length === 0) return Response.json({ error: "This league is full or has already started" }, { status: 409 });
  return Response.json({ ok: true, picks });
}
