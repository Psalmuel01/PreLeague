// End-to-end smoke test against a running server (npm run dev):
// two wallets sign in, draft, get locked out at kick-off, the round settles,
// the winner is recorded, and results/claims behave. Uses admin controls to
// compress the round. Usage: npm run smoke
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const ADMIN = process.env.ADMIN_SECRET || "";

type Json = Record<string, unknown>;

class Player {
  cookie = "";
  constructor(public name: string, public kp = Keypair.generate()) {}
  get wallet() {
    return this.kp.publicKey.toBase58();
  }
  async call(path: string, body?: unknown, method = body ? "POST" : "GET") {
    const res = await fetch(BASE + path, {
      method,
      headers: { "content-type": "application/json", cookie: this.cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0];
    return { status: res.status, json: (await res.json().catch(() => ({}))) as Json };
  }
  async signIn() {
    const { json } = await this.call("/api/auth/nonce", { wallet: this.wallet });
    const sig = nacl.sign.detached(new TextEncoder().encode(json.message as string), this.kp.secretKey);
    const res = await this.call("/api/auth/verify", { wallet: this.wallet, nonce: json.nonce, signature: bs58.encode(sig) });
    assert(res.status === 200, `${this.name} signs in`, res.json);
    await this.call("/api/me", { displayName: this.name });
  }
}

async function admin(action: string, leagueId?: string) {
  const res = await fetch(`${BASE}/api/admin`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-secret": ADMIN },
    body: JSON.stringify({ action, leagueId }),
  });
  return { status: res.status, json: (await res.json()) as Json };
}

let failures = 0;
function assert(ok: boolean, label: string, detail?: unknown) {
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function main() {
  const alice = new Player("Alice");
  const bob = new Player("Bob");
  const mallory = new Player("Mallory");

  const anon = await alice.call("/api/leagues/x/lineup", { picks: [] });
  assert(anon.status === 401, "lineup requires sign-in");

  // Forged signature is rejected
  const { json: n } = await mallory.call("/api/auth/nonce", { wallet: mallory.wallet });
  const forged = nacl.sign.detached(new TextEncoder().encode(n.message as string), Keypair.generate().secretKey);
  const bad = await mallory.call("/api/auth/verify", { wallet: mallory.wallet, nonce: n.nonce, signature: bs58.encode(forged) });
  assert(bad.status === 401, "forged signature rejected");

  await alice.signIn();
  await bob.signIn();

  const { json: s } = await alice.call("/api/series/stocklana-sprint?which=next");
  const id = s.nextId as string;
  assert(Boolean(id), `next round found (${id})`);

  const dup = await alice.call(`/api/leagues/${id}/lineup`, { picks: ["openai", "openai", "spacex"] });
  assert(dup.status === 400, "duplicate picks rejected");
  const two = await alice.call(`/api/leagues/${id}/lineup`, { picks: ["openai", "spacex"] });
  assert(two.status === 400, "two picks rejected");
  const ok1 = await alice.call(`/api/leagues/${id}/lineup`, { picks: ["openai", "anthropic", "spacex"] });
  assert(ok1.status === 200, "Alice locks OpenAI/Anthropic/SpaceX", ok1.json);
  const edit = await alice.call(`/api/leagues/${id}/lineup`, { picks: ["openai", "kalshi", "spacex"] });
  assert(edit.status === 200, "Alice edits before kick-off");
  const ok2 = await bob.call(`/api/leagues/${id}/lineup`, { picks: ["polymarket", "neuralink", "anduril"] });
  assert(ok2.status === 200, "Bob locks Polymarket/Neuralink/Anduril");

  const bots = await admin("bots", id);
  assert(bots.status === 200, "admin seeds demo managers", bots.json);

  const start = await admin("start", id);
  assert(start.status === 200, "admin kicks off the round", start.json);

  const late = await bob.call(`/api/leagues/${id}/lineup`, { picks: ["openai", "kalshi", "spacex"] });
  assert(late.status === 409, "edits rejected after kick-off");

  const live = await alice.call(`/api/leagues/${id}`);
  const standings = live.json.standings as { name: string; rank: number }[] | null;
  assert(live.json.status === "live" && Array.isArray(standings), "live leaderboard has standings", live.json.status);
  assert((live.json.entry as Json | null)?.picks?.toString() === "openai,kalshi,spacex", "server kept Alice's edited lineup");

  await new Promise((r) => setTimeout(r, 2500));
  await admin("snapshot");
  const end = await admin("end", id);
  assert(end.json.status === "completed", "round settles at the final whistle", end.json);

  const again = await admin("settle", id);
  assert(again.json.status === "completed", "settlement is idempotent");

  const final = await alice.call(`/api/leagues/${id}`);
  const fs = final.json.standings as { id: string; rank: number; name: string; portfolioReturn: number }[];
  assert(fs?.length >= 3 && fs[0].rank === 1, `final table frozen (${fs?.length} managers, winner ${fs?.[0]?.name} ${(fs?.[0]?.portfolioReturn * 100).toFixed(3)}%)`);
  assert(final.json.winnerWallet === fs[0].id, "winner recorded on the league");

  const me = await alice.call("/api/me");
  const h = (me.json.history as { leagueId: string; rank: number | null }[]).find((x) => x.leagueId === id);
  assert(Boolean(h && h.rank), `Alice's history shows rank #${h?.rank}`);

  const loser = [alice, bob].find((p) => p.wallet !== final.json.winnerWallet)!;
  const notMine = await loser.call(`/api/leagues/${id}/claim`, {});
  assert(notMine.status === 400, `${loser.name} (not the winner) can't claim`);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
