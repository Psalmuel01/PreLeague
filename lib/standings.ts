import { COMPANY_BY_ID, type CompanyId } from "./companies";
import { opponentsFor, type League } from "./leagues";
import { rankEntries } from "./scoring";

const MIN = 60_000;

export type Manager = {
  id: string;
  name: string;
  initials: string;
  avatar: string;
  mono?: boolean;
  you: boolean;
  picks: CompanyId[];
  lockedAt: number;
};

export type Ranked = Manager & { rank: number; portfolioReturn: number; pickReturns: number[] };

export type YouEntry = { picks: CompanyId[]; lockedAt: number };

export function managersFor(
  league: League,
  kickoff: number,
  entry: YouEntry | undefined,
  you: { name: string; initials: string } = { name: "You", initials: "Y" },
): Manager[] {
  const list: Manager[] = opponentsFor(league).map((o) => ({
    id: o.id,
    name: o.name,
    initials: o.initials,
    avatar: o.avatar,
    mono: Boolean(o.wallet),
    you: false,
    picks: o.picks,
    lockedAt: kickoff - o.lockedMinsBefore * MIN,
  }));
  if (entry) {
    list.push({ id: "you", name: you.name, initials: you.initials, avatar: "av-you", you: true, picks: entry.picks, lockedAt: entry.lockedAt });
  }
  return list;
}

/** Company returns from boundary prices keyed by symbol; null if any price is missing. */
export function companyReturns(
  league: League,
  start: Record<string, number> | undefined,
  now: Record<string, number> | undefined,
): Record<CompanyId, number> | null {
  if (!start || !now) return null;
  const out = {} as Record<CompanyId, number>;
  for (const id of league.pool) {
    const sym = COMPANY_BY_ID[id].symbol;
    if (!start[sym] || !now[sym]) return null;
    out[id] = now[sym] / start[sym] - 1;
  }
  return out;
}

export function standingsFor(managers: Manager[], returns: Record<CompanyId, number> | null): Ranked[] | null {
  return returns ? rankEntries(managers, returns) : null;
}

// ---------- XP & levels ----------

export const XP = { played: 30, earlyBird: 20, podium: 50, win: 100 } as const;

const LEVELS = [
  { at: 0, title: "Rookie" },
  { at: 100, title: "Rookie" },
  { at: 250, title: "Squad player" },
  { at: 450, title: "Squad player" },
  { at: 700, title: "Contender" },
  { at: 1000, title: "Contender" },
  { at: 1350, title: "Contender" },
  { at: 1750, title: "Pro" },
  { at: 2200, title: "Pro" },
  { at: 2700, title: "Legend" },
];

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1];
  return {
    level: i + 1,
    title: LEVELS[i].title,
    floor: LEVELS[i].at,
    next: next?.at ?? null,
    progress: next ? (xp - LEVELS[i].at) / (next.at - LEVELS[i].at) : 1,
  };
}

export function roundXp(rank: number | null, earlyBird: boolean) {
  const parts: { label: string; xp: number }[] = [{ label: "Played a round", xp: XP.played }];
  if (earlyBird) parts.push({ label: "Early bird", xp: XP.earlyBird });
  if (rank !== null && rank <= 3) parts.push({ label: "Podium finish", xp: XP.podium });
  if (rank === 1) parts.push({ label: "Round winner", xp: XP.win });
  return { total: parts.reduce((s, p) => s + p.xp, 0), parts };
}

export const EARLY_BIRD_MS = 5 * MIN;
