-- PreLeague schema. Plain Postgres; runs unchanged on Supabase.

create table if not exists leagues (
  id              text primary key,                 -- "<series>-r<round>"
  series          text not null,                    -- league definition slug
  round           int  not null,
  name            text not null,
  status          text not null default 'upcoming'
                  check (status in ('upcoming', 'live', 'settling', 'completed', 'review_required', 'cancelled')),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  picks_required  int  not null default 3,
  max_players     int  not null,
  pool            text[] not null,
  prize_symbol    text not null,
  prize_usd       numeric not null,
  prize_mint      text,
  -- Frozen at settlement: { SYMBOL: price }
  start_prices    jsonb,
  end_prices      jsonb,
  winner_wallet   text,
  review_reason   text,
  settled_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (series, round),
  check (ends_at > starts_at)
);
create index if not exists leagues_status_idx on leagues (status, ends_at);
create index if not exists leagues_series_idx on leagues (series, starts_at);

create table if not exists profiles (
  wallet        text primary key,
  display_name  text check (char_length(display_name) <= 20),
  is_bot        boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists auth_nonces (
  nonce       text primary key,
  wallet      text not null,
  message     text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz
);

create table if not exists sessions (
  token_hash  text primary key,
  wallet      text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists sessions_wallet_idx on sessions (wallet);

create table if not exists entries (
  id          bigserial primary key,
  league_id   text not null references leagues (id) on delete cascade,
  wallet      text not null,
  picks       text[] not null check (cardinality(picks) = 3),
  -- Last change before kick-off; earlier lock wins ties.
  locked_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (league_id, wallet)
);
create index if not exists entries_wallet_idx on entries (wallet);

create table if not exists price_snapshots (
  id            bigserial primary key,
  symbol        text not null,
  token_price   double precision not null check (token_price > 0),
  mark_price    double precision,
  mint          text,
  captured_at   timestamptz not null,
  source        text not null default 'prestocks',
  unique (symbol, captured_at)
);
create index if not exists price_snapshots_symbol_time_idx on price_snapshots (symbol, captured_at desc);

create table if not exists results (
  league_id     text not null references leagues (id) on delete cascade,
  wallet        text not null,
  rank          int  not null,
  score         double precision not null,
  picks         text[] not null,
  pick_returns  double precision[] not null,
  primary key (league_id, wallet)
);

create table if not exists prize_claims (
  league_id     text primary key references leagues (id),
  wallet        text not null,
  status        text not null check (status in ('pending', 'sent', 'failed')),
  amount_raw    text,
  tx_signature  text,
  error         text,
  network       text not null default 'devnet',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists job_runs (
  id          bigserial primary key,
  job         text not null,
  ok          boolean not null,
  detail      text,
  ran_at      timestamptz not null default now()
);
create index if not exists job_runs_job_idx on job_runs (job, ran_at desc);
