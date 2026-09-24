import { capture } from "@/lib/snapshots";

// Called every minute by a scheduler (e.g. Vercel Cron) to build price history.
// When CRON_SECRET is set, requests must send `Authorization: Bearer <secret>`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const board = await capture();
  return Response.json({
    source: board.source,
    capturedAt: board.capturedAt,
    symbols: Object.keys(board.quotes).length,
  });
}
