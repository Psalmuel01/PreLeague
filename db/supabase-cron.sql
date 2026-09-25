-- Run once in the Supabase SQL editor (not a migration: it needs your app URL
-- and secret, and local Postgres has no pg_net).
--
-- Every minute, Supabase calls /api/cron/tick, which snapshots PreStocks
-- prices, opens rounds at kick-off and settles them after the whistle.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Store the app URL and CRON_SECRET in Vault (replace both values).
select vault.create_secret('https://YOUR-APP.vercel.app', 'preleague_url');
select vault.create_secret('YOUR_CRON_SECRET', 'preleague_cron_secret');

-- 2. Schedule the tick.
select cron.schedule(
  'preleague-tick',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'preleague_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'preleague_cron_secret')
    ),
    timeout_milliseconds := 20000
  );
  $$
);

-- Check it's working (after a minute or two):
--   select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
--   select status_code, left(content::text, 120), created from net._http_response order by created desc limit 5;
--   select max(captured_at) from price_snapshots;   -- should be under a minute old
--
-- Change a secret:  select vault.update_secret((select id from vault.secrets where name = 'preleague_url'), 'https://new-url');
-- Stop it:          select cron.unschedule('preleague-tick');
