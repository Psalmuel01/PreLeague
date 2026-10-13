// End-to-end smoke test against a running server (npm run dev):
// two wallets sign in, draft, get locked out at kick-off, the round settles,
// the winner is recorded, and results/claims behave. Uses admin controls to
// compress the round. Usage: npm run smoke
import { writeFileSync } from "node:fs";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { assertDevnet, vaultConnection } from "../lib/solana/vault";
import { Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const SERIES = process.env.SMOKE_SERIES || "stocklana-sprint";
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
  const alice = new Player("Alice (test)");
  const bob = new Player("Bob (test)");
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

  const { json: s } = await alice.call(`/api/series/${encodeURIComponent(SERIES)}?which=next`);
  const id = s.nextId as string;
  assert(Boolean(id), `next round found (${id})`);
  const pool = (s.round as Json)?.pool as string[];
  if (!id || !pool || pool.length < 4) throw new Error("Smoke test needs an upcoming round with at least four companies");
  const firstPicks = pool.slice(0, 3);
  const editedPicks = [pool[0], pool[2], pool[3]];
  const secondPicks = pool.slice(-3);

  if (process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID) {
    await admin("snapshot");
    const funded = await admin("fund", id);
    assert(funded.status === 200, "prize funded before drafting", funded.json);
    if (funded.status !== 200) throw new Error("Smoke test stopped: escrow needs fresh live token prices and sufficient organizer funds");
  }
  const dup = await alice.call(`/api/leagues/${id}/lineup`, { picks: [pool[0], pool[0], pool[1]] });
  assert(dup.status === 400, "duplicate picks rejected");
  const two = await alice.call(`/api/leagues/${id}/lineup`, { picks: pool.slice(0, 2) });
  assert(two.status === 400, "two picks rejected");
  const ok1 = await alice.call(`/api/leagues/${id}/lineup`, { picks: firstPicks });
  assert(ok1.status === 200, `Alice locks ${firstPicks.join("/")}`, ok1.json);
  const edit = await alice.call(`/api/leagues/${id}/lineup`, { picks: editedPicks });
  assert(edit.status === 200, "Alice edits before kick-off");
  const ok2 = await bob.call(`/api/leagues/${id}/lineup`, { picks: secondPicks });
  assert(ok2.status === 200, `Bob locks ${secondPicks.join("/")}`);

  if (process.env.SMOKE_BOTS !== "0") {
    const bots = await admin("bots", id);
    assert(bots.status === 200, "admin seeds demo managers", bots.json);
  }

  const start = await admin("start", id);
  assert(start.status === 200, "admin kicks off the round", start.json);

  const late = await bob.call(`/api/leagues/${id}/lineup`, { picks: editedPicks });
  assert(late.status === 409, "edits rejected after kick-off");

  // Standings appear once the first snapshot after kick-off is recorded (up to a minute).
  let live = await alice.call(`/api/leagues/${id}`);
  for (let i = 0; i < 18 && !live.json.standings; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    live = await alice.call(`/api/leagues/${id}`);
  }
  const standings = live.json.standings as { name: string; rank: number }[] | null;
  assert(live.json.status === "live" && Array.isArray(standings), "live leaderboard has standings", live.json.status);
  assert((live.json.entry as Json | null)?.picks?.toString() === editedPicks.toString(), "server kept Alice's edited lineup");

  await new Promise((r) => setTimeout(r, 2500));
  await admin("snapshot");
  const end = await admin("end", id);
  assert(end.json.status === "completed", "round settles at the final whistle", end.json);

  const again = await admin("settle", id);
  assert(again.json.status === "completed", "settlement is idempotent");

  const final = await alice.call(`/api/leagues/${id}`);
  const fs = final.json.standings as { id: string; rank: number; name: string; portfolioReturn: number }[];
  assert(fs?.length >= 2 && fs[0].rank === 1, `final table frozen (${fs?.length} managers, winner ${fs?.[0]?.name} ${(fs?.[0]?.portfolioReturn * 100).toFixed(3)}%)`);
  const bestReal = fs.find((x) => !x.id.startsWith("bot:"));
  assert(final.json.winnerWallet === (bestReal?.id ?? null), "prize winner is the best-ranked real wallet (demo players can't win)");

  const me = await alice.call("/api/me");
  const h = (me.json.history as { leagueId: string; rank: number | null }[]).find((x) => x.leagueId === id);
  assert(Boolean(h && h.rank), `Alice's history shows rank #${h?.rank}`);

  const loser = [alice, bob].find((p) => p.wallet !== final.json.winnerWallet)!;
  const notMine = await loser.call(`/api/leagues/${id}/claim`, {});
  assert(notMine.status === 400, `${loser.name} (not the winner) can't claim`);

  if (process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID && process.env.PRIZE_MINT) {
    const finalized = await admin("finalize", id);
    assert(finalized.status === 200, "winner committed to Devnet", finalized.json);
    const winner = [alice, bob].find(p => p.wallet === final.json.winnerWallet);
    if (winner) {
      const connection = vaultConnection(); await assertDevnet(connection);
      try {
        const airdrop = await connection.requestAirdrop(winner.kp.publicKey, 100_000_000);
        await connection.confirmTransaction(airdrop);
      } catch {
        const organizer = Keypair.fromSecretKey(bs58.decode(process.env.PRIZE_AUTHORITY_SECRET!));
        await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: organizer.publicKey, toPubkey: winner.kp.publicKey, lamports: 10_000_000 })), [organizer]);
      }
      const prepared = await winner.call(`/api/leagues/${id}/claim`, {});
      assert(prepared.status === 200 && Boolean(prepared.json.transaction), "unsigned winner claim prepared", prepared.json);
      const transaction = Transaction.from(Buffer.from(prepared.json.transaction as string, "base64"));
      transaction.sign(winner.kp);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction({ signature, blockhash: prepared.json.blockhash as string, lastValidBlockHeight: prepared.json.lastValidBlockHeight as number });
      const paid = await winner.call(`/api/leagues/${id}/claim`, { signature });
      assert(paid.json.status === "sent", `winner signed claim confirmed (${signature})`, paid.json);
      const twice = await winner.call(`/api/leagues/${id}/claim`, {});
      assert(twice.status === 400, "second claim rejected");
      if (!failures) {
        const confirmedRound = await winner.call(`/api/leagues/${id}`);
        writeFileSync("docs/devnet-live-smoke.json", JSON.stringify({ source: "Live PreStocks token prices; automated test wallets labelled (test), not organic participants", leagueId: id, series: SERIES, winner: winner.wallet, claimTx: signature, vault: confirmedRound.json.vault, prices: confirmedRound.json.prices, standings: confirmedRound.json.standings }, null, 2) + "\n");
      }
    }
  }

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
