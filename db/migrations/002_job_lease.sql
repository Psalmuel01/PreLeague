-- A short lease so only one request at a time runs the scheduler tick
-- (visitor-driven ticks on serverless, plus an external cron).
create table if not exists job_lease (
  name   text primary key,
  until  timestamptz not null
);
