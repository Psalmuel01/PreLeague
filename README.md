<p align="center">
  <img src="app/icon.svg" width="72" height="72" alt="PreLeague logo">
</p>

<h1 align="center">PreLeague</h1>

<p align="center">
  <b>Fantasy sports for private companies.</b><br>
  Draft three PreStocks, compete on their real market performance, and win a PreStock prize on Solana.<br>
  <a href="https://preleague.vercel.app">preleague.vercel.app</a>
</p>

---

Built for the Stocklana hackathon. [PreStocks](https://prestocks.com) are tokenized private companies on Solana: OpenAI, Anthropic, SpaceX, Neuralink, Anduril, Figure AI, Kalshi and Polymarket. PreLeague turns them into a game. Pick a squad of three before kick-off. Your score is their average price move over the round, and the best squad wins a real prize token.

Your squad is virtual. You never buy the companies you draft, and entry is free.

## Features

- **Phantom sign-in.** You sign a one-time message to log in. There's no transaction and no fee.
- **Live leagues on a schedule.** Rounds open, lock, go live and settle on their own, and each round is scored from live PreStocks prices.
- **Live leaderboard.** Scores and ranks update every 10 seconds while a round runs.
- **Fair settlement.** Kick-off and final prices are 3-snapshot averages. A stale or missing price sends the round to review instead of scoring it on bad data.
- **On-chain prizes.** The winner claims a PreStock prize to their wallet: a mock token on devnet by default, or real PreStocks on mainnet.
- **Admin console.** Start, end, settle or cancel rounds, and add demo managers, for live demos.

## Leagues

| League | Format | Pool | Prize |
| --- | --- | --- | --- |
| Stocklana Sprint | 15 minutes, a new round every 30 minutes | All 8 companies | $25 SpaceX |
| AI Unicorn Sprint | 1 hour, a new round every 90 minutes | OpenAI, Anthropic, Figure AI, Neuralink | $50 OpenAI |
| Prediction Markets Cup | 1 day | All 8 companies | $30 Kalshi |
| Frontier Tech Weekly | 7 days | SpaceX, Anduril, Neuralink, Figure AI | $100 SpaceX |

Leagues are defined in [`lib/leagues.ts`](lib/leagues.ts).

## Quick start

Requires Node 20+ and Postgres 15+ (local or Supabase).

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL, ADMIN_SECRET, CRON_SECRET
createdb preleague              # skip if using Supabase
npm run db:migrate
npm run prize:setup             # devnet prize wallet + mock prize token (optional)
npm run dev                     # http://localhost:3000
```

With `RUN_JOBS_IN_PROCESS=1` (the default in `.env.example`), the server records PreStocks prices every minute and opens and settles rounds on schedule. No browser needs to be open.

To play a full round in a few minutes, open `/admin`, enter your `ADMIN_SECRET`, and use **Add demo managers → Start now → End & settle** on a round you've drafted in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm test` | Scoring and settlement unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Applies `db/migrations/*.sql` to `DATABASE_URL` |
| `npm run smoke` | End-to-end API test against a running server: sign-in, draft, lock, settle, claim |
| `npm run prize:setup` | Devnet: creates the prize wallet and mock prize token |
| `npm run prize:wallet` | Shows the prize wallet's address and balances, and on mainnet whether each prize is covered |

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. On Supabase, use the transaction pooler (port 6543). |
| `ADMIN_SECRET` | yes | Unlocks `/admin` and `/api/admin` |
| `CRON_SECRET` | in production | Bearer token for `/api/cron/*` |
| `RUN_JOBS_IN_PROCESS` | local only | `1` runs the scheduler inside the server. Leave it unset on Vercel. |
| `JOB_INTERVAL_MS` | no | Scheduler interval (default `60000`) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | no | RPC for the wallet adapter (default: public mainnet-beta) |
| `NEXT_PUBLIC_PRIZE_NETWORK` | no | `devnet` (default) or `mainnet` |
| `PRIZE_AUTHORITY_SECRET` | for prizes | Prize wallet secret key (base58) |
| `PRIZE_MINT` | devnet prizes | The mock prize token, written by `npm run prize:setup` |
| `PRIZE_RPC_URL` | no | RPC for payouts (default: the public RPC for the chosen network) |

Never commit `.env.local`. It holds your database password and the prize wallet key.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Postgres (`pg`) · Solana web3.js + SPL Token (Token-2022) · Phantom wallet adapter · Vitest. There are no on-chain programs: prizes are plain token transfers from a server-held prize wallet.

```
app/                 pages and API routes (app/api/*)
components/          UI: views, shell, providers, design-system bits
lib/                 shared logic: leagues, companies, scoring, settlement, standings
lib/server/          server only: db, sessions, auth, prices, rounds, views, prizes
db/migrations/       SQL schema, applied in order by scripts/migrate.ts
db/supabase-cron.sql per-minute scheduler for Supabase (pg_cron + pg_net)
scripts/             migrate, smoke test, prize wallet tools
```

## Docs

- [How it works](docs/architecture.md): the round lifecycle, scoring, settlement, the scheduler and the data model
- [Prizes](docs/prizes.md): devnet vs mainnet, funding the prize wallet, and how payouts stay safe
- [Deploying](docs/deploying.md): Vercel + Supabase, with the scheduler on Supabase cron
- [API reference](docs/api.md): every endpoint

## Not built yet

- An Anchor prize-vault program for on-chain escrow. Prizes are currently a custodial transfer from the prize wallet.
- Draft-popularity labels in the UI. The API already returns `popularity`.
