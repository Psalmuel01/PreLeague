# How it works

This covers the round lifecycle, scoring, settlement, the scheduler and the data model.

## Round lifecycle

Each league in [`lib/leagues.ts`](../lib/leagues.ts) is a **series**. Each **round** of a series is one row in `leagues`, with an id like `stocklana-sprint-r42`. Recurring series (the sprints) always have rounds created a few periods ahead.

```
upcoming ──kick-off──▶ live ──final whistle──▶ settling ──▶ completed
                                                   │
                                                   └──(no clean prices after 10 min)──▶ review_required
any status ──admin──▶ cancelled
```

1. **Sign in.** Connect Phantom and sign a one-time message that contains a server nonce. The server verifies the ed25519 signature (`tweetnacl`) and sets an httpOnly session cookie. There's no transaction and no fee.
2. **Draft.** `POST /api/leagues/:id/lineup` accepts exactly 3 distinct companies from the league's pool, with one entry per wallet and a capacity limit. You can edit it until kick-off. The lock is enforced in SQL too (`starts_at > now()`), so an edit racing the kick-off still gets rejected.
3. **Prices.** Every minute, the price collector stores every PreStocks `tokenPrice` in `price_snapshots`. It only stores live API data. If the API is down, nothing is written, so the scorer never sees made-up prices.
4. **Live.** From kick-off, the leaderboard compares each pick's latest price with its kick-off price. The page polls every 10 seconds.
5. **Settlement.** After the whistle, the server computes final prices, freezes every manager's result in `results`, and writes the winner, kick-off prices and final prices onto the round.
6. **Prize.** The winner claims on the Claim page. See [prizes.md](prizes.md).

## Scoring

Scoring lives in [`lib/scoring.ts`](../lib/scoring.ts) and [`lib/settlement.ts`](../lib/settlement.ts), both covered by unit tests.

- **Kick-off price:** the average of the first 3 snapshots at or after kick-off, taken within 3 minutes of it.
- **Final price:** the average of the last 3 snapshots at or before the whistle, taken within 3 minutes of it.
- **Pick return:** (final − kick-off) ÷ kick-off.
- **Squad score:** the equal-weight average of the three pick returns.
- **Ties:** the better best pick wins, then the better second-best pick, then whoever locked their lineup first.

Averaging 3 snapshots smooths out a single odd print at the boundary. If any company in the pool has no snapshot inside the 3-minute window, the round isn't scored. It stays in `settling` and retries each tick. After 10 minutes it moves to `review_required`, where an admin can retry settlement or cancel the round.

Settlement is idempotent: running it twice gives the same frozen result.

## The scheduler

A **tick** does three things:
- It makes sure upcoming rounds exist.
- It snapshots prices.
- It moves rounds forward (`upcoming → live`, and `live → settling → completed`).

Something has to trigger it every minute:

| Setup | What triggers the tick |
| --- | --- |
| Local or a long-lived server | `RUN_JOBS_IN_PROCESS=1` starts an in-process loop from [`instrumentation.ts`](../instrumentation.ts) |
| Vercel | Supabase `pg_cron` calls `GET /api/cron/tick` every minute ([`db/supabase-cron.sql`](../db/supabase-cron.sql)) |
| Page views, as a backup | `/api/prices`, `/api/leagues` and `/api/series/*` run a tick after responding if the newest snapshot is over ~50 s old |

A short lease in `job_lease` means only one tick runs at a time, however many triggers fire.

## Data model

Migrations are in [`db/migrations`](../db/migrations) and are applied in order by `npm run db:migrate`.

| Table | Holds |
| --- | --- |
| `leagues` | One row per round: series, schedule, pool, prize, status, kick-off and final prices, winner |
| `entries` | A manager's three picks for a round, plus when they were locked |
| `results` | Frozen per-manager returns and ranks after settlement |
| `price_snapshots` | Every recorded PreStocks price: symbol, token price, mark price, time |
| `profiles` | Display names by wallet |
| `auth_nonces`, `sessions` | Wallet sign-in |
| `prize_claims` | One claim per round: status, network, transaction signature |
| `job_runs`, `job_lease` | Scheduler log (shown in `/admin`) and the single-runner lock |

## Code map

| Where | What |
| --- | --- |
| `lib/leagues.ts`, `lib/companies.ts` | League definitions, the company list and PreStock mints |
| `lib/scoring.ts`, `lib/settlement.ts`, `lib/standings.ts` | Pure scoring and settlement logic (unit tested) |
| `lib/server/prices.ts` | Price collector and snapshot queries |
| `lib/server/rounds.ts` | Round creation, the tick, settlement, admin actions |
| `lib/server/views.ts` | The round view the pages render: standings, popularity, claim |
| `lib/server/auth.ts`, `lib/server/session.ts` | Nonce sign-in and sessions |
| `lib/server/prize.ts` | Prize payouts |
| `components/views/*` | One view per page: Home, Leagues, Draft, Locked, Live, Results, Claim, Profile |
| `components/providers/*` | Wallet, session, game state and live prices |
