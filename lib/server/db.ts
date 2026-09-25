import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

// One pool per server process (survives Next dev hot reloads).
const g = globalThis as unknown as { __preleaguePool?: Pool };

export function pool(): Pool {
  if (!g.__preleaguePool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    g.__preleaguePool = new Pool({
      connectionString,
      max: 5,
      ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
    });
  }
  return g.__preleaguePool;
}

export async function q<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!process.env.DEBUG_SQL) return (await pool().query<T>(text, params)).rows;
  const t0 = performance.now();
  const rows = (await pool().query<T>(text, params)).rows;
  console.log("[sql]", `${(performance.now() - t0).toFixed(1)}ms`, text.replace(/\s+/g, " ").slice(0, 70));
  return rows;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

export async function logJob(job: string, ok: boolean, detail?: string) {
  if (!ok) console.error(`[job:${job}]`, detail);
  try {
    await q("insert into job_runs (job, ok, detail) values ($1, $2, $3)", [job, ok, detail?.slice(0, 2000) ?? null]);
  } catch {
    // Logging must never break the job itself.
  }
}
