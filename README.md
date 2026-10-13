<p align="center">
  <img src="app/icon.svg" width="72" height="72" alt="PreLeague logo">
</p>

<h1 align="center">PreLeague</h1>

<p align="center">
  <b>Fantasy sports for private companies.</b><br>
  Draft three PreStocks, compete on their real market performance, and claim a prize on Solana.<br>
  <a href="https://preleague.vercel.app">Live app</a> · <a href="https://youtu.be/PZ7RTIi_1eY">Demo video</a>
</p>

<p align="center">
  <a href="https://youtu.be/PZ7RTIi_1eY"><img src="https://img.youtube.com/vi/PZ7RTIi_1eY/hqdefault.jpg" width="640" alt="Watch the PreLeague demo video"></a>
</p>

---

Built for the Stocklana hackathon. [PreStocks](https://prestocks.com) are Solana tokens that give exposure to private companies: OpenAI, Anthropic, SpaceX, Neuralink, Anduril, Figure AI, Kalshi and Polymarket. PreLeague turns them into a game. Pick a squad of three before kick-off. Your score is their average price move over the round, and the best real player claims the prize. The hackathon prize flow uses mock tokens escrowed on Solana Devnet. Scoring remains offchain; the vault commits the winner and settlement receipt hash and permits a wallet-signed claim.

Your squad is virtual. You never buy the companies you draft, and entry is free.

## Features

- **Phantom sign-in.** You sign a one-time message to log in. There's no transaction and no fee.
- **Live leagues on a schedule.** Rounds open, lock, go live and settle on their own, and each round is scored from live PreStocks prices.
- **Live leaderboard.** Scores and ranks update every 10 seconds while a round runs.
- **Fair settlement.** Kick-off and final prices are 3-snapshot averages. A stale or missing price sends the round to review instead of scoring it on bad data.
- **On-chain prizes.** The prize winner claims a PreStock prize to their wallet: a mock token escrowed on Devnet, claimed with their own wallet signature.
- **Admin console.** Start, end, settle or cancel rounds, and add demo players for live demos. Demo players are labelled "Demo" and can never win the prize.

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
| `NEXT_PUBLIC_PRIZE_NETWORK` | no | `devnet` only for escrow |
| `PRIZE_AUTHORITY_SECRET` | for prizes | Organizer secret key (base58); funds escrow and commits settlements |
| `NEXT_PUBLIC_VAULT_PROGRAM_ID` | for escrow | Deployed Devnet Anchor program |
| `NEXT_PUBLIC_VAULT_RPC_URL` | no | Devnet RPC used for vault funding, finalization and claims |
| `PRIZE_MINT` | devnet prizes | The mock prize token, written by `npm run prize:setup` |
| `PRIZE_RPC_URL` | no | RPC for payouts (default: the public RPC for the chosen network) |

Never commit `.env.local`. It holds your database password and the prize wallet key.

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Postgres (`pg`) · Solana web3.js + SPL Token (Token-2022) · Phantom wallet adapter · Vitest. The Anchor prize vault holds mock tokens on Devnet; the organizer funds escrow and commits results, and winners sign their own claims. See docs/prizes.md for deployment and verification.

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
- [Prizes](docs/prizes.md): Devnet vault deployment, funding, immutable receipts, and wallet-signed claims
- [Deploying](docs/deploying.md): Vercel + Supabase, with the scheduler on Supabase cron
- [API reference](docs/api.md): every endpoint

## Not built yet

- Restore SpaceX token prices for leagues whose pool includes SpaceX, and demonstrate the claim with a human Phantom user. AI Unicorn Sprint has passed the full live-price Devnet integration smoke test with labelled test wallets; see [prizes](docs/prizes.md).
- Draft-popularity labels in the UI. The API already returns `popularity`.
