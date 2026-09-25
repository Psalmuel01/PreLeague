import { hasSecret } from "@/lib/server/session";
import { tick } from "@/lib/server/rounds";

// Everything in one call: schedule rounds, snapshot prices, advance/settle leagues.
export async function GET(request: Request) {
  if (!hasSecret(request, "CRON_SECRET")) return new Response("Unauthorized", { status: 401 });
  return Response.json(await tick());
}
