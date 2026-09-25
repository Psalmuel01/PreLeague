import { ALL_COMPANY_IDS, type CompanyId } from "./companies";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type Schedule =
  /** Rounds kick off every `periodMs` (aligned to the epoch + offset) and last `durationMs`. */
  | { kind: "recurring"; periodMs: number; durationMs: number; offsetMs: number; firstRoundAt: number }
  /** A single round. */
  | { kind: "once"; kickoff: number; durationMs: number; round: number };

export type League = {
  slug: string;
  name: string;
  tagline: string;
  format: string; // "15-minute sprint"
  runs: string;
  schedule: Schedule;
  pool: CompanyId[];
  poolNote: string;
  capacity: number;
  prize: { company: CompanyId; usd: number };
  featured?: boolean;
  /** Opponent slots already filled for display when the league has no live opponents. */
  fullOverride?: boolean;
};

export type Opponent = {
  id: string;
  name: string;
  initials: string;
  avatar: string; // av-1..av-8
  wallet?: string;
  picks: [CompanyId, CompanyId, CompanyId];
  /** Minutes before kick-off they locked. */
  lockedMinsBefore: number;
};

export const LEAGUES: League[] = [
  {
    slug: "stocklana-sprint",
    name: "Stocklana Sprint",
    tagline: "Fifteen minutes. Three picks. Best average return takes the prize.",
    format: "15-minute sprint",
    runs: "Runs 15 minutes",
    schedule: {
      kind: "recurring",
      periodMs: 30 * MIN,
      durationMs: 15 * MIN,
      offsetMs: 0,
      firstRoundAt: Date.UTC(2026, 8, 24, 12, 0),
    },
    pool: ALL_COMPANY_IDS,
    poolNote: "8-company pool",
    capacity: 20,
    prize: { company: "spacex", usd: 25 },
    featured: true,
  },
  {
    slug: "ai-unicorn-sprint",
    name: "AI Unicorn Sprint",
    tagline: "An hour on the frontier of AI. Pick three, beat the room.",
    format: "1-hour sprint",
    runs: "Runs 1 hour",
    schedule: {
      kind: "recurring",
      periodMs: 90 * MIN,
      durationMs: 60 * MIN,
      offsetMs: 20 * MIN,
      firstRoundAt: Date.UTC(2026, 8, 24, 12, 20),
    },
    pool: ["openai", "anthropic", "figureai", "neuralink"],
    poolNote: "OpenAI, Anthropic, Figure AI, Neuralink",
    capacity: 30,
    prize: { company: "openai", usd: 50 },
  },
  {
    slug: "prediction-markets-cup",
    name: "Prediction Markets Cup",
    tagline: "A full day of event-market exposure. Kalshi, Polymarket and friends.",
    format: "1-day league",
    runs: "Runs 1 day",
    schedule: { kind: "once", kickoff: new Date(2026, 8, 26, 18, 0).getTime(), durationMs: DAY, round: 1 },
    pool: ALL_COMPANY_IDS,
    poolNote: "Kalshi, Polymarket + others",
    capacity: 20,
    prize: { company: "kalshi", usd: 30 },
    fullOverride: true,
  },
  {
    slug: "frontier-tech-weekly",
    name: "Frontier Tech Weekly",
    tagline: "Rockets, robots, defense and brain tech. Seven days to prove it.",
    format: "7-day league",
    runs: "Runs 7 days",
    schedule: { kind: "once", kickoff: new Date(2026, 8, 28, 9, 0).getTime(), durationMs: 7 * DAY, round: 12 },
    pool: ["spacex", "anduril", "neuralink", "figureai"],
    poolNote: "Rockets, robots, defense, brain tech",
    capacity: 100,
    prize: { company: "spacex", usd: 100 },
    featured: true,
  },
];

export const LEAGUE_BY_SLUG = Object.fromEntries(LEAGUES.map((l) => [l.slug, l])) as Record<string, League>;
export const DEFAULT_LEAGUE = LEAGUES[0];

// Demo opponents. Their squads are virtual like everyone's; returns are
// computed from the same PreStock prices as yours.
const OPPONENTS: Opponent[] = [
  { id: "kenny", name: "Kenny", initials: "K", avatar: "av-3", picks: ["openai", "spacex", "figureai"], lockedMinsBefore: 9 },
  { id: "michelle", name: "Michelle", initials: "M", avatar: "av-7", picks: ["kalshi", "openai", "anduril"], lockedMinsBefore: 7 },
  { id: "tobi", name: "Tobi", initials: "T", avatar: "av-5", picks: ["anthropic", "anduril", "figureai"], lockedMinsBefore: 12 },
  { id: "marcus", name: "Marcus", initials: "M", avatar: "av-4", picks: ["figureai", "neuralink", "kalshi"], lockedMinsBefore: 4 },
  { id: "ada", name: "Ada", initials: "A", avatar: "av-2", picks: ["spacex", "kalshi", "polymarket"], lockedMinsBefore: 6 },
  { id: "priya", name: "Priya", initials: "P", avatar: "av-6", picks: ["anthropic", "neuralink", "anduril"], lockedMinsBefore: 3 },
  { id: "8frt", name: "8fRt…a91F", initials: "8f", avatar: "av-8", wallet: "8fRtQx2bLk9mVn4pWz7sYc1dHe3jKa91F", picks: ["kalshi", "polymarket", "anduril"], lockedMinsBefore: 2 },
  { id: "sade", name: "Sade", initials: "S", avatar: "av-1", picks: ["neuralink", "polymarket", "spacex"], lockedMinsBefore: 10 },
  { id: "diego", name: "Diego", initials: "D", avatar: "av-5", picks: ["neuralink", "polymarket", "anduril"], lockedMinsBefore: 1 },
  { id: "jun", name: "Jun", initials: "J", avatar: "av-4", picks: ["polymarket", "neuralink", "kalshi"], lockedMinsBefore: 5 },
  { id: "leah", name: "Leah", initials: "L", avatar: "av-7", picks: ["polymarket", "neuralink", "anduril"], lockedMinsBefore: 8 },
];

/** Opponents whose whole squad fits the league's pool. */
export function opponentsFor(league: League): Opponent[] {
  const pool = new Set(league.pool);
  const fits = OPPONENTS.filter((o) => o.picks.every((p) => pool.has(p)));
  if (fits.length >= 6) return fits;
  // Small pools: remap picks into the pool deterministically so the table isn't empty.
  const n = league.pool.length;
  return OPPONENTS.slice(0, 9).map((o, i) => {
    const picks = Array.from(new Set([0, 1, 2].map((k) => league.pool[(i + k * 3) % n])));
    for (const p of league.pool) if (picks.length < 3 && !picks.includes(p)) picks.push(p);
    return { ...o, picks: picks as Opponent["picks"] };
  });
}

// ---------- Schedule ----------

export type Phase = "upcoming" | "live" | "final";

export type RoundState = {
  round: number;
  phase: Phase;
  kickoff: number;
  endsAt: number;
  /** ms until the next boundary for this phase (deadline or final whistle). */
  remaining: number;
};

/** The round a player would act on right now: the live one, else the next to open. */
export function currentRound(league: League, now: number): RoundState {
  const s = league.schedule;
  if (s.kind === "once") {
    const endsAt = s.kickoff + s.durationMs;
    const phase: Phase = now < s.kickoff ? "upcoming" : now < endsAt ? "live" : "final";
    return {
      round: s.round,
      phase,
      kickoff: s.kickoff,
      endsAt,
      remaining: phase === "upcoming" ? s.kickoff - now : phase === "live" ? endsAt - now : 0,
    };
  }
  const k = Math.floor((now - s.offsetMs) / s.periodMs);
  const kickoff = k * s.periodMs + s.offsetMs;
  if (now < kickoff + s.durationMs) {
    return roundAt(league, kickoff, now);
  }
  return roundAt(league, kickoff + s.periodMs, now);
}

/** The next round a player can still draft for, or null if none is scheduled. */
export function joinableRound(league: League, now: number): RoundState | null {
  const r = currentRound(league, now);
  if (r.phase === "upcoming") return r;
  const s = league.schedule;
  if (s.kind === "once") return null;
  return roundAt(league, r.kickoff + s.periodMs, now);
}

/** The most recent round that has finished. */
export function lastFinishedRound(league: League, now: number): RoundState | null {
  const s = league.schedule;
  if (s.kind === "once") {
    const r = currentRound(league, now);
    return r.phase === "final" ? r : null;
  }
  let kickoff = Math.floor((now - s.offsetMs) / s.periodMs) * s.periodMs + s.offsetMs;
  if (now < kickoff + s.durationMs) kickoff -= s.periodMs;
  return roundAt(league, kickoff, now);
}

/** State of a specific round by kick-off time (recurring leagues). */
export function roundAt(league: League, kickoff: number, now: number): RoundState {
  const s = league.schedule;
  const durationMs = s.durationMs;
  const endsAt = kickoff + durationMs;
  const phase: Phase = now < kickoff ? "upcoming" : now < endsAt ? "live" : "final";
  const round =
    s.kind === "once" ? s.round : Math.max(1, Math.round((kickoff - s.firstRoundAt) / s.periodMs) + 1);
  return {
    round,
    phase,
    kickoff,
    endsAt,
    remaining: phase === "upcoming" ? kickoff - now : phase === "live" ? endsAt - now : 0,
  };
}

export function roundKey(league: League, kickoff: number): string {
  return `${league.slug}@${kickoff}`;
}

export function durationMs(league: League): number {
  return league.schedule.durationMs;
}
