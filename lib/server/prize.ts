import "server-only";
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  calculateEpochFee,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  createTransferCheckedWithFeeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getScaledUiAmountConfig,
  getTransferFeeConfig,
  type Mint,
} from "@solana/spl-token";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { prizeNetwork } from "@/lib/network";
import { logJob, q } from "./db";
import { getLeague } from "./rounds";

// Prize payouts from the server's prize wallet (PRIZE_AUTHORITY_SECRET).
// Custodial for now; an on-chain vault replaces it later.
//   devnet  (default): a mock prize token (PRIZE_MINT) made by `npm run prize:setup`.
//   mainnet: the real PreStock (Token-2022) of the league's prize company.
// NEXT_PUBLIC_PRIZE_NETWORK picks the cluster.
//
// Safety:
// - Never a partial payout: the wallet must hold the full prize (plus SOL for fees).
// - Never a double payout: the signed transaction's signature is saved before it
//   is sent; a retry checks that signature on-chain and only re-sends once the
//   first transaction's blockhash has expired without landing.

const MIN_SOL_FOR_CLAIM = 0.0025; // new winner token account rent (~0.0016) + fees, with headroom

export function prizeWallet(): Keypair | null {
  const secret = process.env.PRIZE_AUTHORITY_SECRET;
  return secret ? Keypair.fromSecretKey(bs58.decode(secret)) : null;
}

export function prizeConnection(): Connection {
  const fallback = prizeNetwork() === "mainnet" ? "https://api.mainnet-beta.solana.com" : "https://api.devnet.solana.com";
  return new Connection(process.env.PRIZE_RPC_URL || fallback, "confirmed");
}

/** The token paid for a company's prize: its PreStock on mainnet, the mock prize token on devnet. */
export function prizeMintAddress(company: CompanyId): PublicKey | null {
  if (prizeNetwork() === "mainnet") return new PublicKey(COMPANY_BY_ID[company].mint);
  return process.env.PRIZE_MINT ? new PublicKey(process.env.PRIZE_MINT) : null;
}

/** Displayed (UI) token amounts = raw × the mint's scaled-UI multiplier. PreStocks prices are per displayed token. */
export function uiMultiplier(mint: Mint): number {
  const cfg = getScaledUiAmountConfig(mint);
  if (!cfg) return 1;
  const now = BigInt(Math.floor(Date.now() / 1000));
  return cfg.newMultiplierEffectiveTimestamp > BigInt(0) && now >= cfg.newMultiplierEffectiveTimestamp ? cfg.newMultiplier : cfg.multiplier;
}

export async function loadMint(connection: Connection, mintKey: PublicKey) {
  const info = await connection.getAccountInfo(mintKey);
  if (!info) throw new Error(`Prize mint ${mintKey.toBase58()} not found on ${prizeNetwork()}`);
  const programId = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  return { mintKey, programId, mint: await getMint(connection, mintKey, "confirmed", programId) };
}

export type ClaimResult = { status: "sent" | "pending" | "failed"; tx?: string | null; error?: string | null };

type ClaimRow = { status: "pending" | "sent" | "failed"; tx_signature: string | null; last_valid_block_height: string | null; network: string };

export async function claimPrize(leagueId: string, wallet: string): Promise<ClaimResult> {
  const league = await getLeague(leagueId);
  if (!league || league.status !== "completed") return { status: "failed", error: "This league hasn’t been settled yet" };
  if (league.winner_wallet !== wallet) return { status: "failed", error: "Only the winner can claim this prize" };
  const authority = prizeWallet();
  const prizeMint = prizeMintAddress(league.prize_symbol);
  if (!authority || !prizeMint) return { status: "failed", error: "Prize payouts aren’t configured on this server" };
  const connection = prizeConnection();

  // Existing claim? Resolve it against the chain before doing anything new.
  const [existing] = await q<ClaimRow>(`select status, tx_signature, last_valid_block_height, network from prize_claims where league_id = $1`, [leagueId]);
  if (existing?.status === "sent") return { status: "sent", tx: existing.tx_signature };
  if (existing?.status === "pending" && existing.tx_signature) {
    // Sent on the other cluster before a network switch: only that cluster can resolve it.
    if (existing.network !== prizeNetwork()) return { status: "pending", tx: existing.tx_signature, error: `This claim is waiting on Solana ${existing.network}` };
    const resolved = await resolvePending(connection, leagueId, existing);
    if (resolved) return resolved;
  }

  // Take (or retake) the claim.
  const [claim] = await q<{ status: string }>(
    `insert into prize_claims (league_id, wallet, status, network) values ($1, $2, 'pending', $3)
     on conflict (league_id) do update set status = 'pending', error = null, network = excluded.network, tx_signature = null, last_valid_block_height = null, updated_at = now()
       where prize_claims.status = 'failed'
     returning status`,
    [leagueId, wallet, prizeNetwork()],
  );
  if (!claim) return { status: "pending", error: "This claim is already being processed" };

  let signature: string | null = null;
  try {
    const symbol = COMPANY_BY_ID[league.prize_symbol].symbol;
    const price = league.end_prices?.[symbol];
    if (!price) throw new UserError(`No settlement price for ${symbol}`);

    const { mintKey, programId, mint } = await loadMint(connection, prizeMint);
    // USD → displayed tokens → raw units (undo the display multiplier).
    const amount = BigInt(Math.floor((Number(league.prize_usd) / price / uiMultiplier(mint)) * 10 ** mint.decimals));
    if (amount <= BigInt(0)) throw new UserError("Prize amount rounds to zero");

    const from = getAssociatedTokenAddressSync(mintKey, authority.publicKey, false, programId);
    const to = getAssociatedTokenAddressSync(mintKey, new PublicKey(wallet), false, programId);
    const balance = await getAccount(connection, from, "confirmed", programId).then((a) => a.amount, () => BigInt(0));
    if (balance < amount) throw new UserError(`The prize wallet doesn’t hold enough ${symbol}${prizeNetwork() === "devnet" ? " (devnet)" : ""} for this prize yet`);
    const lamports = await connection.getBalance(authority.publicKey);
    if (lamports < MIN_SOL_FOR_CLAIM * LAMPORTS_PER_SOL) throw new UserError("The prize wallet needs a little SOL to pay network fees");

    const feeConfig = programId.equals(TOKEN_2022_PROGRAM_ID) ? getTransferFeeConfig(mint) : null;
    const transferIx = feeConfig
      ? createTransferCheckedWithFeeInstruction(
          from, mintKey, to, authority.publicKey, amount, mint.decimals,
          calculateEpochFee(feeConfig, BigInt((await connection.getEpochInfo()).epoch), amount), [], programId,
        )
      : createTransferCheckedInstruction(from, mintKey, to, authority.publicKey, amount, mint.decimals, [], programId);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: authority.publicKey, blockhash, lastValidBlockHeight }).add(
      createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, to, new PublicKey(wallet), mintKey, programId),
      transferIx,
    );
    tx.sign(authority);
    signature = bs58.encode(tx.signature!);

    // Record the signature before sending so a crash can never lead to a second payout.
    await q(`update prize_claims set tx_signature = $2, last_valid_block_height = $3, amount_raw = $4, updated_at = now() where league_id = $1`, [
      leagueId, signature, lastValidBlockHeight, amount.toString(),
    ]);
    await connection.sendRawTransaction(tx.serialize(), { maxRetries: 5 });
    const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);

    await q(`update prize_claims set status = 'sent', updated_at = now() where league_id = $1`, [leagueId]);
    await logJob("claim", true, `${leagueId} → ${wallet}: ${signature}`);
    return { status: "sent", tx: signature };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (signature) {
      // Sent (or maybe sent): leave it pending; the next claim call checks the chain.
      await q(`update prize_claims set error = $2, updated_at = now() where league_id = $1`, [leagueId, message.slice(0, 500)]);
      await logJob("claim", false, `${leagueId}: ${message} (signature ${signature} left pending)`);
      return { status: "pending", tx: signature, error: "Your prize is on its way — check back in a minute." };
    }
    await q(`update prize_claims set status = 'failed', error = $2, updated_at = now() where league_id = $1`, [leagueId, message.slice(0, 500)]);
    await logJob("claim", false, `${leagueId}: ${message}`);
    return { status: "failed", error: err instanceof UserError ? err.message : "The transfer didn’t go through. Your prize is still safe — try again." };
  }
}

/** Settle a pending claim from the chain. Returns null when it's safe to send again. */
async function resolvePending(connection: Connection, leagueId: string, row: ClaimRow): Promise<ClaimResult | null> {
  const sig = row.tx_signature!;
  const { value } = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
  if (value && !value.err && (value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized")) {
    await q(`update prize_claims set status = 'sent', error = null, updated_at = now() where league_id = $1`, [leagueId]);
    return { status: "sent", tx: sig };
  }
  if (value?.err) {
    await q(`update prize_claims set status = 'failed', error = $2, updated_at = now() where league_id = $1`, [leagueId, JSON.stringify(value.err)]);
    return null;
  }
  const height = await connection.getBlockHeight("confirmed");
  if (row.last_valid_block_height && height > Number(row.last_valid_block_height)) {
    // Blockhash expired and the transaction never landed: safe to try again.
    await q(`update prize_claims set status = 'failed', error = 'expired before landing', updated_at = now() where league_id = $1`, [leagueId]);
    return null;
  }
  return { status: "pending", tx: sig, error: "Your prize is on its way — check back in a minute." };
}

class UserError extends Error {}
