import { logout } from "@/lib/server/session";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
