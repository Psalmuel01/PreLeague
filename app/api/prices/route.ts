import { latestBoard, snapshotsSince } from "@/lib/snapshots";

// GET /api/prices            → latest token/mark prices for the draft pool
// GET /api/prices?since=<ms> → also returns recorded snapshots since that time
export async function GET(request: Request) {
  const board = await latestBoard();
  const since = Number(new URL(request.url).searchParams.get("since"));
  return Response.json(
    {
      ...board,
      snapshots: Number.isFinite(since) && since > 0 ? snapshotsSince(since) : undefined,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
