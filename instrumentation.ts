// Runs the scheduler inside the Node server when RUN_JOBS_IN_PROCESS=1 (local
// dev or a single long-lived server). On serverless hosting, leave it off and
// call /api/cron/tick every minute instead (see vercel.json).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.RUN_JOBS_IN_PROCESS !== "1") return;
  const g = globalThis as unknown as { __preleagueScheduler?: boolean };
  if (g.__preleagueScheduler) return;
  g.__preleagueScheduler = true;
  const { tick } = await import("./lib/server/rounds");
  const every = Number(process.env.JOB_INTERVAL_MS) || 60_000;
  const run = () => tick().catch((err) => console.error("[scheduler]", err));
  run();
  setInterval(run, every);
  console.log(`[scheduler] price collection + settlement every ${every / 1000}s`);
}
