# PreLeague

Fantasy sports for private companies. Draft three PreStocks, compete on their real market performance, and win a PreStock prize on Solana.

## Run it locally

Requires Node 20 and Postgres 15 (local or Supabase).

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL, ADMIN_SECRET, CRON_SECRET
createdb preleague              # skip if using Supabase
npm run db:migrate
npm run dev                     # http://localhost:3000
```

With `RUN_JOBS_IN_PROCESS=1`, the server snapshots PreStocks prices every minute and opens and settles rounds on schedule. No browser needs to be open.

```bash
npm test           # scoring + settlement unit tests
npm run smoke      # end-to-end API test against the running server
npm run build
```

### Devnet prizes

```bash
npm run prize:setup
```

This creates a prize wallet, funds it with devnet SOL, mints a mock `SPACEX` prize token, and writes `PRIZE_AUTHORITY_SECRET` / `PRIZE_MINT` to `.env.local`. If the devnet faucet is rate-limited, send devnet SOL to the printed address from https://faucet.solana.com and run it again. Until the mint exists, a winner's claim returns a clear "not configured" error.

## How a round works

1. **Schedule.** Stocklana Sprint opens a new 15-minute round every 30 minutes. Each round is a row in `leagues`, with status `upcoming → live → settling → completed` (or `review_required` / `cancelled`).
2. **Sign in.** Connect Phantom and sign a one-time message. The server verifies the ed25519 signature and sets an httpOnly session cookie. No transaction, no fee.
3. **Draft.** `POST /api/leagues/:id/lineup` validates exactly 3 distinct companies from the pool, one entry per wallet and the capacity limit. It allows edits only before kick-off, and the check runs in SQL too, so late edits are rejected even in a race.
4. **Prices.** Every minute, all eight PreStocks `tokenPrice`s go into `price_snapshots`.
5. **Live table.** The kick-off price is the average of the first 3 snapshots after the start. Returns and rank are recomputed from the latest snapshot. The page polls every 10 seconds.
6. **Settlement.** After the whistle, the average of the last 3 snapshots is the end price. Results, prices and the winner are frozen in `results` and `leagues`. Re-running settlement is safe. If any company lacks a snapshot within 3 minutes of kick-off or the whistle, the round goes to `review_required` instead of being scored on stale data.
7. **Prize.** The winner claims on the Claim page. The server sends the mock PreStock token on devnet and records the transaction in `prize_claims`.

Scoring (`lib/scoring.ts`, `lib/settlement.ts`): return = (end − start) ÷ start, and a squad's score is the equal-weight average of its three picks. Ties go to the best single pick, then the second-best pick, then the earlier lineup lock.

## Admin

`/admin` (enter `ADMIN_SECRET`) shows the latest snapshot and recent job logs. Per round, it can add demo managers, start now, end & settle, retry settlement and cancel. Use it to run a complete round during a demo.

## Deploying

- **Database:** set `DATABASE_URL` to your Supabase Postgres connection string and run `npm run db:migrate`.
- **Serverless (Vercel):** leave `RUN_JOBS_IN_PROCESS` unset. `vercel.json` schedules `/api/cron/tick` every minute; set `CRON_SECRET`. Per-minute crons need a paid Vercel plan.
- **Single long-lived server:** keep `RUN_JOBS_IN_PROCESS=1`.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/prices` | Latest stored prices (`?since=` adds snapshot history) |
| GET | `/api/leagues` | Every league series with live / next / last round summaries |
| GET | `/api/series/:slug?which=current\|next\|live\|last\|<id>` | One round, full view |
| GET | `/api/leagues/:id` | One round by id |
| POST | `/api/auth/nonce`, `/api/auth/verify`, `/api/auth/logout` | Wallet sign-in |
| GET/POST | `/api/me` | Your profile and history / set display name |
| POST | `/api/leagues/:id/lineup` | Create or edit your lineup (before kick-off) |
| POST | `/api/leagues/:id/claim` | Winner claims the prize |
| GET | `/api/cron/tick`, `/api/cron/prices`, `/api/cron/settle` | Scheduled jobs (Bearer `CRON_SECRET`) |
| GET/POST | `/api/admin` | Admin status and actions (`x-admin-secret`) |

## Not built yet

- Anchor prize-vault program (on-chain escrow). Prizes are currently a custodial devnet transfer.
- Real PreStock prizes on mainnet.
- Draft-popularity labels in the UI (the API already returns `popularity`).
