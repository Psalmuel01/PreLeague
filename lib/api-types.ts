// JSON shapes shared by the API routes and the client.
import type { CompanyId } from "./companies";

export type LeagueStatus = "upcoming" | "live" | "settling" | "completed" | "review_required" | "cancelled";

export type ManagerJSON = {
  id: string; // wallet (bots: "bot:<name>")
  name: string;
  initials: string;
  avatar: string;
  mono: boolean;
  bot: boolean;
  you: boolean;
  picks: CompanyId[];
  lockedAt: number;
};

export type StandingJSON = ManagerJSON & { rank: number; portfolioReturn: number; pickReturns: number[] };

export type RoundJSON = {
  id: string;
  series: string;
  round: number;
  name: string;
  status: LeagueStatus;
  startsAt: number;
  endsAt: number;
  maxPlayers: number;
  pool: CompanyId[];
  prize: { company: CompanyId; usd: number; mint: string | null };
  managers: ManagerJSON[];
  entry: ManagerJSON | null;
  /** Share of managers who drafted each company. */
  popularity: Record<string, number>;
  prices: {
    start: Record<string, number> | null;
    now: Record<string, number> | null;
    nowAt: number | null;
    /** Latest snapshot is older than the staleness window. */
    stale: boolean;
  };
  returns: Record<string, number> | null;
  standings: StandingJSON[] | null;
  winnerWallet: string | null;
  reviewReason: string | null;
  claim: { status: "pending" | "sent" | "failed"; tx: string | null; error: string | null; network: string } | null;
};

export type SeriesJSON = {
  slug: string;
  live: RoundSummary | null;
  next: RoundSummary | null;
  last: RoundSummary | null;
};

export type RoundSummary = {
  id: string;
  round: number;
  status: LeagueStatus;
  startsAt: number;
  endsAt: number;
  managers: number;
  joined: boolean;
  leaders: { name: string; initials: string; avatar: string; you: boolean; portfolioReturn: number }[];
};

export type HistoryJSON = {
  leagueId: string;
  series: string;
  round: number;
  status: LeagueStatus;
  startsAt: number;
  endsAt: number;
  picks: CompanyId[];
  lockedAt: number;
  rank: number | null;
  score: number | null;
  pickReturns: number[] | null;
  managers: number;
  winner: { name: string; initials: string; avatar: string; you: boolean; score: number } | null;
  prize: { company: CompanyId; usd: number };
  claim: "pending" | "sent" | "failed" | null;
};

export type MeJSON = {
  wallet: string | null;
  displayName: string | null;
  history: HistoryJSON[];
};
