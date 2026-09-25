import { hasSecret } from "@/lib/server/session";
import { advance, ensureRounds } from "@/lib/server/rounds";

// Opens rounds at kick-off and settles finished ones. Idempotent; schedule every minute.
export async function GET(request: Request) {
  if (!hasSecret(request, "CRON_SECRET")) return new Response("Unauthorized", { status: 401 });
  await ensureRounds();
  await advance();
  return Response.json({ ok: true });
}
