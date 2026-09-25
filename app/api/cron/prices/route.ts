import { hasSecret } from "@/lib/server/auth";
import { collectPrices } from "@/lib/server/prices";

// Price collector. Schedule every minute; send `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!hasSecret(request, "CRON_SECRET")) return new Response("Unauthorized", { status: 401 });
  const board = await collectPrices();
  return Response.json({ source: board.source, capturedAt: board.capturedAt, symbols: Object.keys(board.quotes).length });
}
