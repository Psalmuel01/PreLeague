import "server-only";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getMint, getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";
import { COMPANY_BY_ID } from "@/lib/companies";
import { logJob, q } from "./db";
import { getLeague } from "./rounds";

// Hackathon prize settlement: a mock PreStock SPL token on Solana devnet, held
// by a server authority and transferred to the winner on claim. Swap for the
// Anchor prize vault / mainnet PreStock mint later.

export type PrizeConfig = { connection: Connection; authority: Keypair; mint: PublicKey; network: "devnet" };

export function prizeConfig(): PrizeConfig | null {
  const secret = process.env.PRIZE_AUTHORITY_SECRET;
  const mint = process.env.PRIZE_MINT;
  if (!secret || !mint) return null;
  return {
    connection: new Connection(process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com", "confirmed"),
    authority: Keypair.fromSecretKey(bs58.decode(secret)),
    mint: new PublicKey(mint),
    network: "devnet",
  };
}

export type ClaimResult = { status: "sent" | "pending" | "failed"; tx?: string | null; error?: string | null };

export async function claimPrize(leagueId: string, wallet: string): Promise<ClaimResult> {
  const league = await getLeague(leagueId);
  if (!league || league.status !== "completed") return { status: "failed", error: "This league hasn’t been settled yet" };
  if (league.winner_wallet !== wallet) return { status: "failed", error: "Only the winner can claim this prize" };
  const cfg = prizeConfig();
  if (!cfg) return { status: "failed", error: "Prize payouts aren’t configured on this server (run npm run prize:setup)" };

  // One claim per league. A failed claim can be retried; a pending or sent one can't.
  const [claim] = await q<{ status: string; tx_signature: string | null }>(
    `insert into prize_claims (league_id, wallet, status) values ($1, $2, 'pending')
     on conflict (league_id) do update set status = 'pending', error = null, updated_at = now()
       where prize_claims.status = 'failed'
     returning status, tx_signature`,
    [leagueId, wallet],
  );
  if (!claim) {
    const [existing] = await q<{ status: "sent" | "pending"; tx_signature: string | null }>(`select status, tx_signature from prize_claims where league_id = $1`, [leagueId]);
    return { status: existing.status, tx: existing.tx_signature };
  }

  try {
    const symbol = COMPANY_BY_ID[league.prize_symbol].symbol;
    const price = league.end_prices?.[symbol];
    if (!price) throw new Error(`No settlement price for ${symbol}`);
    const mintInfo = await getMint(cfg.connection, cfg.mint);
    const raw = BigInt(Math.floor((Number(league.prize_usd) / price) * 10 ** mintInfo.decimals));
    const from = await getOrCreateAssociatedTokenAccount(cfg.connection, cfg.authority, cfg.mint, cfg.authority.publicKey);
    const to = await getOrCreateAssociatedTokenAccount(cfg.connection, cfg.authority, cfg.mint, new PublicKey(wallet));
    const sig = await transfer(cfg.connection, cfg.authority, from.address, to.address, cfg.authority, raw);
    await q(`update prize_claims set status = 'sent', tx_signature = $2, amount_raw = $3, updated_at = now() where league_id = $1`, [leagueId, sig, raw.toString()]);
    await logJob("claim", true, `${leagueId} → ${wallet}: ${sig}`);
    return { status: "sent", tx: sig };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await q(`update prize_claims set status = 'failed', error = $2, updated_at = now() where league_id = $1`, [leagueId, message.slice(0, 500)]);
    await logJob("claim", false, `${leagueId}: ${message}`);
    return { status: "failed", error: "The transfer didn’t go through. Your prize is still safe — try again." };
  }
}

