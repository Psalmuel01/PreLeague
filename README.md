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

### Prizes (devnet or mainnet)

Winners are paid from a server-held prize wallet. `NEXT_PUBLIC_PRIZE_NETWORK` picks the network, and the UI labels prizes to match.

**Devnet (default): free, for demos.** Prizes are a mock prize token.

```bash
npm run prize:setup
```

This creates the prize wallet (`PRIZE_AUTHORITY_SECRET`) and a mock prize token (`PRIZE_MINT`), mints 1,000 tokens to the wallet, and writes both to `.env.local`. If the devnet airdrop is rate-limited, send devnet SOL to the printed address from https://faucet.solana.com and run it again. Re-running is safe.

**Mainnet: real PreStocks.** Set `NEXT_PUBLIC_PRIZE_NETWORK=mainnet` (and `PRIZE_AUTHORITY_SECRET`), then:

```bash
npm run prize:wallet
```

This shows the wallet address, its SOL, its PreStock balances and whether each league's prize is covered. With no `PRIZE_AUTHORITY_SECRET` set, it generates one for you.

To fund it, send to the wallet address:

- **SOL:** at least 0.0025 per claim. This pays the network fee and the winner's token account (~0.002 SOL rent) if they don't hold that PreStock yet.
- **The prize PreStock** for each league you run, worth at least the prize in USD (see `prize` in `lib/leagues.ts`). PreStocks withhold a 1–3% transfer fee, so the winner receives slightly less than the prize value.

To switch networks, change `NEXT_PUBLIC_PRIZE_NETWORK` and redeploy. The value is baked into the client at build time.

How a claim pays out (`lib/server/prize.ts`):

- USD → tokens at the settlement price, adjusted for the mint's display multiplier (for example SPACEX ×5 after its split).
- It never sends a partial prize. If the wallet is short on tokens or SOL, the claim fails with a clear message and can be retried after funding.
- It never pays twice. The signed transaction's signature is saved before sending. A retry checks that signature on-chain, and only sends again once the first transaction's blockhash has expired without landing.
- Set `PRIZE_RPC_URL` to a private RPC for reliable sends. The public ones rate-limit.

`npm run smoke` claims the prize on devnet when `PRIZE_MINT` is set. On mainnet it skips the payout unless you run `SMOKE_CLAIM=1 npm run smoke`, since that spends real prize tokens.

## How a round works

1. **Schedule.** Stocklana Sprint opens a new 15-minute round every 30 minutes. Each round is a row in `leagues`, with status `upcoming → live → settling → completed` (or `review_required` / `cancelled`).
2. **Sign in.** Connect Phantom and sign a one-time message. The server verifies the ed25519 signature and sets an httpOnly session cookie. No transaction, no fee.
3. **Draft.** `POST /api/leagues/:id/lineup` validates exactly 3 distinct companies from the pool, one entry per wallet and the capacity limit. It allows edits only before kick-off, and the check runs in SQL too, so late edits are rejected even in a race.
4. **Prices.** Every minute, all eight PreStocks `tokenPrice`s go into `price_snapshots`.
5. **Live table.** The kick-off price is the average of the first 3 snapshots after the start. Returns and rank are recomputed from the latest snapshot. The page polls every 10 seconds.
6. **Settlement.** After the whistle, the average of the last 3 snapshots is the end price. Results, prices and the winner are frozen in `results` and `leagues`. Re-running settlement is safe. If any company lacks a snapshot within 3 minutes of kick-off or the whistle, the round goes to `review_required` instead of being scored on stale data.
7. **Prize.** The winner claims on the Claim page. The server sends the prize to the winning wallet (a mock token on devnet, the real PreStock on mainnet) and records the transaction in `prize_claims`.

Scoring (`lib/scoring.ts`, `lib/settlement.ts`): return = (end − start) ÷ start, and a squad's score is the equal-weight average of its three picks. Ties go to the best single pick, then the second-best pick, then the earlier lineup lock.

## Admin

`/admin` (enter `ADMIN_SECRET`) shows the latest snapshot and recent job logs. Per round, it can add demo managers, start now, end & settle, retry settlement and cancel. Use it to run a complete round during a demo.

## Deploying (Vercel Hobby friendly)

No Vercel Cron is needed, because Hobby only allows daily crons.

1. **Database:** create a Supabase project and set `DATABASE_URL` to its **transaction pooler** connection string (port 6543). Run `npm run db:migrate` once against it from your machine.
2. **Region:** `vercel.json` pins functions to `dub1` (Dublin) to sit next to a Supabase project in `eu-west-1`. If your database is elsewhere, change it to the nearest [Vercel region](https://vercel.com/docs/edge-network/regions). Every query crosses this gap.
3. **Vercel env vars:** `DATABASE_URL`, `ADMIN_SECRET`, `CRON_SECRET`, `PRIZE_AUTHORITY_SECRET`, `NEXT_PUBLIC_PRIZE_NETWORK` (`devnet` or `mainnet`), `PRIZE_MINT` (devnet only), optionally `PRIZE_RPC_URL` and `NEXT_PUBLIC_SOLANA_RPC_URL`. Leave `RUN_JOBS_IN_PROCESS` unset.
4. **Keep prices flowing:** have Supabase call `/api/cron/tick` every minute. Put your app URL and `CRON_SECRET` into [`db/supabase-cron.sql`](db/supabase-cron.sql) and run it in the Supabase SQL editor; it uses `pg_cron` + `pg_net`. Any external per-minute pinger sending `Authorization: Bearer <CRON_SECRET>` works too.

Page views also keep things moving. When `/api/prices`, `/api/leagues` or `/api/series/*` is requested and the newest snapshot is older than about 50 seconds, the server runs the scheduler tick after sending the response. A lease in `job_lease` ensures only one runs at a time. The external pinger covers quiet periods, so rounds get kick-off and whistle prices even with nobody on the site.

On a single long-lived server (Railway, Fly, a VM), you can instead set `RUN_JOBS_IN_PROCESS=1` and skip the pinger.

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

- Anchor prize-vault program (on-chain escrow). Prizes are currently a custodial transfer from the prize wallet.
- Draft-popularity labels in the UI (the API already returns `popularity`).
