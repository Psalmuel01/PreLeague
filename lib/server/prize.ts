import "server-only";
import bs58 from "bs58";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  calculateEpochFee,
  getAccount,
  getMint,
  getOrCreateAssociatedTokenAccount,
  getScaledUiAmountConfig,
  getTransferFeeConfig,
  transferChecked,
  transferCheckedWithFee,
} from "@solana/spl-token";
import { COMPANY_BY_ID } from "@/lib/companies";
import { prizeNetwork, type PrizeNetwork } from "@/lib/network";
import { logJob, q } from "./db";
import { getLeague } from "./rounds";

// Prize payouts from a server-held prize wallet (custodial; the Anchor prize
// vault replaces this later).
//   devnet  (default): a mock SPL token (PRIZE_MINT) created by `npm run prize:setup`.
//   mainnet: the real PreStock mint of the league's prize company (Token-2022),
//            paid from the prize wallet's own balance.

type PrizeConfig = { connection: Connection; authority: Keypair; network: PrizeNetwork };

function prizeConfig(): PrizeConfig | null {
  const secret = process.env.PRIZE_AUTHORITY_SECRET;
  if (!secret) return null;
  const network = prizeNetwork();
  const rpc =
    process.env.PRIZE_RPC_URL ||
    (network === "mainnet" ? "https://api.mainnet-beta.solana.com" : process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com");
  return { connection: new Connection(rpc, "confirmed"), authority: Keypair.fromSecretKey(bs58.decode(secret)), network };
}

function prizeMint(network: PrizeNetwork, company: keyof typeof COMPANY_BY_ID): PublicKey | null {
  if (network === "mainnet") return new PublicKey(COMPANY_BY_ID[company].mint);
  return process.env.PRIZE_MINT ? new PublicKey(process.env.PRIZE_MINT) : null;
}

/** Token amounts are displayed × the mint's scaled-UI multiplier (Token-2022); raw amounts aren't. */
function uiMultiplier(mint: Awaited<ReturnType<typeof getMint>>): number {
  const cfg = getScaledUiAmountConfig(mint);
  if (!cfg) return 1;
  const now = BigInt(Math.floor(Date.now() / 1000));
  return cfg.newMultiplierEffectiveTimestamp > BigInt(0) && now >= cfg.newMultiplierEffectiveTimestamp ? cfg.newMultiplier : cfg.multiplier;
}

export type ClaimResult = { status: "sent" | "pending" | "failed"; tx?: string | null; error?: string | null };

export async function claimPrize(leagueId: string, wallet: string): Promise<ClaimResult> {
  const league = await getLeague(leagueId);
  if (!league || league.status !== "completed") return { status: "failed", error: "This league hasn’t been settled yet" };
  if (league.winner_wallet !== wallet) return { status: "failed", error: "Only the winner can claim this prize" };
  const cfg = prizeConfig();
  const mintKey = cfg && prizeMint(cfg.network, league.prize_symbol);
  if (!cfg || !mintKey) return { status: "failed", error: "Prize payouts aren’t configured on this server" };

  // One claim per league. A failed claim can be retried; a pending or sent one can't.
  const [claim] = await q<{ status: string; tx_signature: string | null }>(
    `insert into prize_claims (league_id, wallet, status, network) values ($1, $2, 'pending', $3)
     on conflict (league_id) do update set status = 'pending', error = null, network = excluded.network, updated_at = now()
       where prize_claims.status = 'failed'
     returning status, tx_signature`,
    [leagueId, wallet, cfg.network],
  );
  if (!claim) {
    const [existing] = await q<{ status: "sent" | "pending"; tx_signature: string | null }>(`select status, tx_signature from prize_claims where league_id = $1`, [leagueId]);
    return { status: existing.status, tx: existing.tx_signature };
  }

  try {
    const { connection, authority } = cfg;
    const symbol = COMPANY_BY_ID[league.prize_symbol].symbol;
    const price = league.end_prices?.[symbol];
    if (!price) throw new Error(`No settlement price for ${symbol}`);

    const mintAccount = await connection.getAccountInfo(mintKey);
    if (!mintAccount) throw new Error(`Prize mint ${mintKey.toBase58()} not found on ${cfg.network}`);
    const programId = mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const mint = await getMint(connection, mintKey, "confirmed", programId);

    // USD → displayed tokens → raw units (undo the display multiplier).
    const uiTokens = Number(league.prize_usd) / price;
    const target = BigInt(Math.floor((uiTokens / uiMultiplier(mint)) * 10 ** mint.decimals));

    const from = await getOrCreateAssociatedTokenAccount(connection, authority, mintKey, authority.publicKey, false, "confirmed", undefined, programId);
    const balance = (await getAccount(connection, from.address, "confirmed", programId)).amount;
    if (balance === BigInt(0)) throw new Error("Prize wallet has no tokens for this prize");
    const amount = target <= balance ? target : balance;
    const to = await getOrCreateAssociatedTokenAccount(connection, authority, mintKey, new PublicKey(wallet), false, "confirmed", undefined, programId);

    // PreStocks charge a transfer fee (withheld from what the winner receives).
    const feeConfig = programId.equals(TOKEN_2022_PROGRAM_ID) ? getTransferFeeConfig(mint) : null;
    const sig = feeConfig
      ? await transferCheckedWithFee(
          connection,
          authority,
          from.address,
          mintKey,
          to.address,
          authority,
          amount,
          mint.decimals,
          calculateEpochFee(feeConfig, BigInt((await connection.getEpochInfo()).epoch), amount),
          [],
          { commitment: "confirmed" },
          programId,
        )
      : await transferChecked(connection, authority, from.address, mintKey, to.address, authority, amount, mint.decimals, [], { commitment: "confirmed" }, programId);

    await q(`update prize_claims set status = 'sent', tx_signature = $2, amount_raw = $3, updated_at = now() where league_id = $1`, [leagueId, sig, amount.toString()]);
    await logJob("claim", true, `${leagueId} → ${wallet} on ${cfg.network}: ${sig}`);
    return { status: "sent", tx: sig };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await q(`update prize_claims set status = 'failed', error = $2, updated_at = now() where league_id = $1`, [leagueId, message.slice(0, 500)]);
    await logJob("claim", false, `${leagueId}: ${message}`);
    return { status: "failed", error: "The transfer didn’t go through. Your prize is still safe — try again." };
  }
}
