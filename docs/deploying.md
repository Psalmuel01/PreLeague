# Deploying

This setup runs PreLeague on **Vercel (Hobby is fine) + Supabase**, with Supabase cron driving the scheduler. It needs no Vercel Cron; Hobby only allows daily crons anyway.

## 1. Database (Supabase)

1. Create a Supabase project.
2. Copy the **transaction pooler** connection string (Settings → Database, port `6543`).
3. Apply the schema from your machine:

   ```bash
   DATABASE_URL='postgres://…:6543/postgres' npm run db:migrate
   ```

   Re-run this after pulling new migrations. It only applies the new ones.

## 2. Region

[`vercel.json`](../vercel.json) pins functions to `dub1` (Dublin), next to a Supabase project in `eu-west-1`. Every page makes a few database round trips, so a cross-ocean gap shows up as slow pages. If your database is elsewhere, change the region to the nearest [Vercel region](https://vercel.com/docs/edge-network/regions).

## 3. Environment variables (Vercel)

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the pooler string from step 1 |
| `ADMIN_SECRET` | a long random string |
| `CRON_SECRET` | a long random string |
| `NEXT_PUBLIC_PRIZE_NETWORK` | `devnet` or `mainnet` |
| `PRIZE_AUTHORITY_SECRET` | the prize wallet key (see [prizes.md](prizes.md)) |
| `PRIZE_MINT` | devnet only: the mock prize token |
| `PRIZE_RPC_URL`, `NEXT_PUBLIC_SOLANA_RPC_URL` | optional private RPCs |

Leave `RUN_JOBS_IN_PROCESS` unset on Vercel. Redeploy after changing any `NEXT_PUBLIC_*` value.

## 4. Scheduler (Supabase cron)

Rounds need a price snapshot every minute, and in particular right at kick-off and at the whistle.

1. Open [`db/supabase-cron.sql`](../db/supabase-cron.sql) and replace the app URL and `CRON_SECRET` placeholders.
2. Run it in the Supabase SQL editor. It stores both values in Vault and schedules `pg_net` to call `GET /api/cron/tick` every minute.
3. Check it after a couple of minutes:

   ```sql
   select max(captured_at) from price_snapshots;  -- should be under a minute old
   ```

The same file has queries for checking the job log, changing secrets and unscheduling. Any external per-minute pinger that sends `Authorization: Bearer <CRON_SECRET>` works too.

Page views are a backup trigger: when a page's data is requested and prices are over ~50 s old, a tick runs after the response. With nobody on the site, only the cron keeps rounds moving.

## Other hosts

On a single long-lived server (Railway, Fly, a VM), set `RUN_JOBS_IN_PROCESS=1` and skip the cron. The server runs the tick itself every `JOB_INTERVAL_MS` (default 60 s).

## After deploying

- `/admin` (with `ADMIN_SECRET`) shows the latest snapshot and the job log. If "latest snapshot" isn't ticking forward, the cron isn't reaching the app.
- "Waiting for kick-off prices…" on a live round means the scheduler hasn't recorded snapshots since kick-off yet. It clears within a minute or two once the cron is running.
