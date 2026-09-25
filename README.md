# PreLeague

Fantasy sports for private companies. Draft three PreStocks, compete on their real market performance, and win actual PreStocks on Solana.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # scoring engine unit tests
npm run build
```

Open `http://localhost:3000/?demo` to show the **demo panel** (bottom right). It can jump the clock to the deadline, kick-off or final whistle, and switch to **simulated prices** so rankings visibly move in a short video. Simulated prices are labelled everywhere they appear. `?demo=0` hides the panel again.

## Screens

| Route | Screen |
| --- | --- |
| `/` | Home: hero, featured league, draft pool, live table |
| `/leagues` | Live / Upcoming / Completed leagues, your level |
| `/league/[slug]` | Lobby: rules, draft pool, managers |
| `/league/[slug]/draft` | Pick your 3 (sticky tray + sheet on mobile) |
| `/league/[slug]/locked` | Squad locked, shareable team sheet |
| `/league/[slug]/live` | Live table, squad breakdown drawer, market movers, company sheet |
| `/league/[slug]/results` | Podium, your result, XP, final table, transparent scoring |
| `/league/[slug]/claim` | Prize claim |
| `/profile` | Level, stats, achievements, history, active leagues |
| `/how-it-works` | Steps, scoring, full rules, FAQ |

The UI follows the "Matchday" design system from the design canvas. `app/pl.css` is that stylesheet verbatim; `app/globals.css` adapts the fixed artboards to real breakpoints (1440 → 1024 → 768 → 390 → 375).

## How it works

- **Prices:** `GET /api/prices` proxies the PreStocks API (`tokenPrice`, `markPrice`, mint) and records snapshots in memory. `GET /api/cron/prices` takes a snapshot on a schedule (protect it with `CRON_SECRET`). If the API is unreachable, the last known prices are served and flagged as such.
- **Scoring** (`lib/scoring.ts`, tested): return = (end − start) ÷ start; squad = equal-weight average. Boundary prices average the first/last snapshots of the round, and a stale boundary throws instead of scoring. Tie-breaks: best pick → second-best pick → earlier lock.
- **Rounds** (`lib/leagues.ts`): Stocklana Sprint runs every 30 minutes (15-minute round). Opponents are demo managers whose returns come from the same prices as yours.
- **Lineups** are signed with the connected wallet (message signature, no transaction). They are stored in the browser for now.

## Not built yet

- Supabase persistence for `price_snapshots`, `entries` and `results`. The in-memory store in `lib/snapshots.ts` has the same shape.
- The Anchor prize vault (`create_league` / `settle` / `claim`). Until `NEXT_PUBLIC_PRIZE_VAULT_PROGRAM_ID` is set, claiming is disabled, or simulated in demo mode.
- Real opponents. The other managers are seeded demo players.
