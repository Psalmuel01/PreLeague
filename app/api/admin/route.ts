import { hasSecret } from "@/lib/server/auth";
import { q } from "@/lib/server/db";
import { collectPrices } from "@/lib/server/prices";
import { adminCancel, adminEndNow, adminSeedBots, adminStartNow, settleLeague, tick } from "@/lib/server/rounds";

// Admin controls for demos. Requires `x-admin-secret: $ADMIN_SECRET`.
export async function GET(request: Request) {
  if (!hasSecret(request, "ADMIN_SECRET")) return new Response("Unauthorized", { status: 401 });
  const leagues = await q(
    `select l.id, l.series, l.round, l.status, l.starts_at, l.ends_at, l.winner_wallet, l.review_reason,
            (select count(*) from entries e where e.league_id = l.id)::int as players
     from leagues l where l.ends_at > now() - interval '3 hours' or l.status in ('live', 'settling', 'review_required')
     order by l.starts_at limit 40`,
  );
  const [latest] = await q<{ captured_at: Date | null; n: string }>(`select max(captured_at) as captured_at, count(*) as n from price_snapshots`);
  const jobs = await q(`select job, ok, detail, ran_at from job_runs order by ran_at desc limit 15`);
  return Response.json({ leagues, latestSnapshot: latest?.captured_at ?? null, snapshots: Number(latest?.n ?? 0), jobs });
}

export async function POST(request: Request) {
  if (!hasSecret(request, "ADMIN_SECRET")) return new Response("Unauthorized", { status: 401 });
  const { action, leagueId } = (await request.json().catch(() => ({}))) as { action?: string; leagueId?: string };
  try {
    switch (action) {
      case "snapshot":
        return Response.json({ source: (await collectPrices()).source });
      case "tick":
        return Response.json(await tick());
      case "start":
        await adminStartNow(leagueId!);
        break;
      case "end":
        return Response.json(await adminEndNow(leagueId!));
      case "settle":
        return Response.json(await settleLeague(leagueId!));
      case "cancel":
        await adminCancel(leagueId!);
        break;
      case "bots":
        await adminSeedBots(leagueId!);
        break;
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
