import { logout } from "@/lib/server/auth";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
