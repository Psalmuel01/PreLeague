import "server-only";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { LEAGUES, LEAGUE_BY_SLUG, opponentsFor, roundAt, type League } from "@/lib/leagues";
import { SCORING, settle } from "@/lib/settlement";
import { logJob, q, tx } from "./db";
import { collectPrices, snapshotsBetween } from "./prices";

export type LeagueStatus = "upcoming" | "live" | "settling" | "completed" | "review_required" | "cancelled";

export type LeagueRow = {
  id: string;
  series: string;
  round: number;
  name: string;
  status: LeagueStatus;
  starts_at: Date;
  ends_at: Date;
  picks_required: number;
  max_players: number;
  pool: CompanyId[];
  prize_symbol: CompanyId;
  prize_usd: string;
  prize_mint: string | null;
  start_prices: Record<string, number> | null;
  end_prices: Record<string, number> | null;
  winner_wallet: string | null;
  review_reason: string | null;
  settled_at: Date | null;
};

/** Wait this long after the whistle so the final snapshot lands before settling. */
const SETTLE_GRACE_MS = 20_000;
/** Give up waiting for end prices after this long and flag the round for review. */
const REVIEW_AFTER_MS = 10 * 60_000;

export const leagueId = (series: string, round: number) => `${series}-r${round}`;

/** Create league rows for the rounds around `now` (idempotent). */
export async function ensureRounds(now = Date.now()) {
  for (const def of LEAGUES) {
    const s = def.schedule;
    const kickoffs: number[] = [];
    if (s.kind === "once") kickoffs.push(s.kickoff);
    else {
      const k = Math.floor((now - s.offsetMs) / s.periodMs);
      // Previous, current and the next four rounds (admin "start now" can use up upcoming ones).
      for (let i = k - 1; i <= k + 4; i++) kickoffs.push(i * s.periodMs + s.offsetMs);
    }
    for (const kickoff of kickoffs) {
      const r = roundAt(def, kickoff, now);
      await q(
        `insert into leagues (id, series, round, name, starts_at, ends_at, max_players, pool, prize_symbol, prize_usd)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (series, round) do nothing`,
        [leagueId(def.slug, r.round), def.slug, r.round, def.name, new Date(r.kickoff), new Date(r.endsAt), def.capacity, def.pool, def.prize.company, def.prize.usd],
      );
    }
  }
}

/** upcoming → live at kick-off; live → settled (or review) after the whistle. */
export async function advance(now = Date.now()) {
  await q(`update leagues set status = 'live' where status = 'upcoming' and starts_at <= $1`, [new Date(now)]);
  const due = await q<{ id: string }>(
    `select id from leagues where status in ('live', 'settling') and ends_at <= $1 order by ends_at`,
    [new Date(now - SETTLE_GRACE_MS)],
  );
  for (const { id } of due) await settleLeague(id, now);
}

/** Settle one league. Safe to call repeatedly; completed leagues are left untouched. */
export async function settleLeague(id: string, now = Date.now(), opts: { retryReview?: boolean } = {}): Promise<{ status: LeagueStatus; reason?: string }> {
  return tx(async (c) => {
    const [league] = (await c.query<LeagueRow>(`select * from leagues where id = $1 for update skip locked`, [id])).rows;
    if (!league) return { status: "settling" as LeagueStatus, reason: "busy" };
    const settleable = ["live", "settling", ...(opts.retryReview ? ["review_required"] : [])];
    if (!settleable.includes(league.status)) return { status: league.status };

    const symbols = league.pool.map((p) => COMPANY_BY_ID[p].symbol);
    const startsAt = league.starts_at.getTime();
    const endsAt = league.ends_at.getTime();
    const snapshots = await snapshotsBetween(symbols, startsAt - SCORING.maxStalenessMs, endsAt + SCORING.maxStalenessMs);
    const entries = (
      await c.query<{ wallet: string; picks: CompanyId[]; locked_at: Date }>(`select wallet, picks, locked_at from entries where league_id = $1`, [id])
    ).rows;

    const out = settle({
      startsAt,
      endsAt,
      symbols,
      snapshots,
      entries: entries.map((e) => ({ wallet: e.wallet, picks: e.picks.map((p) => COMPANY_BY_ID[p].symbol), lockedAt: e.locked_at.getTime() })),
    });

    if (!out.ok) {
      const status: LeagueStatus = now - endsAt > REVIEW_AFTER_MS ? "review_required" : "settling";
      await c.query(`update leagues set status = $2, review_reason = $3 where id = $1`, [id, status, out.reason]);
      await logJob("settle", status !== "review_required", `${id}: ${out.reason}`);
      return { status, reason: out.reason };
    }

    const bySymbol = Object.fromEntries(league.pool.map((p) => [COMPANY_BY_ID[p].symbol, p]));
    for (const r of out.results) {
      await c.query(
        `insert into results (league_id, wallet, rank, score, picks, pick_returns) values ($1, $2, $3, $4, $5, $6)
         on conflict (league_id, wallet) do nothing`,
        [id, r.wallet, r.rank, r.score, r.picks.map((s) => bySymbol[s]), r.pickReturns],
      );
    }
    await c.query(
      `update leagues set status = 'completed', start_prices = $2, end_prices = $3, winner_wallet = $4, review_reason = null, settled_at = now() where id = $1`,
      [id, out.startPrices, out.endPrices, out.winner],
    );
    await logJob("settle", true, `${id}: ${out.results.length} entries, winner ${out.winner ?? "none"}`);
    return { status: "completed" as LeagueStatus };
  });
}

/** One scheduler tick: schedule rounds, snapshot prices, move statuses, settle. */
export async function tick(now = Date.now()) {
  try {
    await ensureRounds(now);
    await collectPrices();
    await advance(Date.now());
    return { ok: true };
  } catch (err) {
    await logJob("tick", false, err instanceof Error ? err.stack ?? err.message : String(err));
    return { ok: false, error: String(err) };
  }
}

// ---------- Reads ----------

export async function getLeague(id: string): Promise<LeagueRow | null> {
  return (await q<LeagueRow>(`select * from leagues where id = $1`, [id]))[0] ?? null;
}

/** The round of a series a page should show: live, next open, or last finished. */
export async function seriesRounds(series: string, now = Date.now()) {
  await ensureRounds(now);
  const rows = await q<LeagueRow>(`select * from leagues where series = $1 and status <> 'cancelled' order by starts_at`, [series]);
  const t = new Date(now);
  const live = rows.find((r) => r.status === "live" || (r.status === "upcoming" && r.starts_at <= t && r.ends_at > t)) ?? null;
  const next = rows.find((r) => r.status === "upcoming" && r.starts_at > t) ?? null;
  const last = [...rows].reverse().find((r) => ["completed", "review_required", "settling"].includes(r.status) || (r.status === "live" && r.ends_at <= t)) ?? null;
  return { live, next, last };
}

export function seriesDef(series: string): League | undefined {
  return LEAGUE_BY_SLUG[series];
}

// ---------- Admin ----------

export async function adminStartNow(id: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "upcoming") throw new Error("Only an upcoming league can be started");
  const duration = league.ends_at.getTime() - league.starts_at.getTime();
  // Whole seconds, so the kick-off snapshot (stored per second) falls inside the round.
  const now = Math.floor(Date.now() / 1000) * 1000;
  await q(`update leagues set starts_at = $2, ends_at = $3, status = 'live' where id = $1`, [id, new Date(now), new Date(now + duration)]);
  await collectPrices();
}

export async function adminEndNow(id: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "live") throw new Error("Only a live league can be ended");
  await collectPrices();
  await q(`update leagues set ends_at = $2 where id = $1`, [id, new Date(Date.now())]);
  return settleLeague(id, Date.now() + SETTLE_GRACE_MS);
}

export async function adminCancel(id: string) {
  await q(`update leagues set status = 'cancelled' where id = $1 and status not in ('completed')`, [id]);
}

export async function adminSeedBots(id: string) {
  const league = await getLeague(id);
  if (!league) throw new Error("League not found");
  if (league.starts_at.getTime() <= Date.now()) throw new Error("Lineups are locked; seed bots before kick-off");
  const def = LEAGUE_BY_SLUG[league.series];
  for (const o of opponentsFor(def)) {
    const wallet = `bot:${o.id}`;
    await q(`insert into profiles (wallet, display_name, is_bot) values ($1, $2, true) on conflict (wallet) do nothing`, [wallet, o.name.slice(0, 20)]);
    await q(
      `insert into entries (league_id, wallet, picks, locked_at) values ($1, $2, $3, $4) on conflict (league_id, wallet) do nothing`,
      [id, wallet, o.picks, new Date(Math.min(Date.now(), league.starts_at.getTime() - o.lockedMinsBefore * 60_000))],
    );
  }
}
