import "server-only";
import bs58 from "bs58";
import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { COMPANY_BY_ID } from "@/lib/companies";
import { assertDevnet, vaultConnection, readVault, initializeInstruction, fundInstruction, finalizeInstruction, payoutInstruction, sha256 } from "@/lib/solana/vault";
import { settlementReceipt, type SettlementReceipt } from "@/lib/solana/receipt";
import { logJob, q } from "./db";
import { getLeague } from "./rounds";
import { latestQuotes } from "./prices";

export function prizeWallet() {
  const secret = process.env.PRIZE_AUTHORITY_SECRET;
  if (!secret) throw new Error("Prize organizer is not configured");
  return Keypair.fromSecretKey(bs58.decode(secret));
}
export function prizeAuthorityAddress() {
  return process.env.PRIZE_AUTHORITY_ADDRESS ? new PublicKey(process.env.PRIZE_AUTHORITY_ADDRESS) : prizeWallet().publicKey;
}
export const prizeConnection = vaultConnection;

/** Retrying after a crash is safe: each operation is one-way and enforced by the program. */
export async function fundLeague(id: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "upcoming" || league.starts_at.getTime() <= Date.now()) throw new Error("Fund prizes before kick-off");
  const connection = vaultConnection();
  await assertDevnet(connection);
  const authority = prizeWallet();
  if (!process.env.PRIZE_MINT) throw new Error("Configure the devnet mock prize mint first");
  const mint = new PublicKey(process.env.PRIZE_MINT);
  let state = await readVault(connection, id);
  if (!state) {
    const quotes = await latestQuotes();
    const quote = quotes.find(p => p.symbol === COMPANY_BY_ID[league.prize_symbol].symbol);
    if (!quote || Date.now() - quote.capturedAt > 120_000 || quote.tokenPrice <= 0) throw new Error("A fresh prize-company price is needed to fund escrow");
    const decimals = (await getMint(connection, mint)).decimals;
    const amount = BigInt(Math.floor(Number(league.prize_usd) / quote.tokenPrice * 10 ** decimals));
    if (amount <= BigInt(0)) throw new Error("Prize rounds to zero");
    const signature = await sendAndConfirmTransaction(connection, new Transaction().add(await initializeInstruction(id, authority.publicKey, mint, amount), await fundInstruction(id, authority.publicKey, mint)), [authority]);
    await q(`update leagues set prize_mint = $2, vault_funding_tx = $3 where id = $1`, [id, mint.toBase58(), signature]);
    state = await readVault(connection, id);
  } else {
    if (state.authority !== authority.publicKey.toBase58() || state.mint !== mint.toBase58() || state.cancelled || state.finalized) throw new Error("Escrow configuration mismatch");
    if (!state.funded) {
      const signature = await sendAndConfirmTransaction(connection, new Transaction().add(await fundInstruction(id, authority.publicKey, mint)), [authority]);
      await q(`update leagues set vault_funding_tx = $2 where id = $1`, [id, signature]);
    }
    await q(`update leagues set prize_mint = $2 where id = $1`, [id, mint.toBase58()]);
  }
  return readVault(connection, id);
}
export async function finalizeLeague(id: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "completed" || !league.winner_wallet) return;
  if (!league.settlement_payload || !league.settlement_hash) throw new Error("Settlement receipt is missing");
  const receipt = settlementReceipt(league.settlement_payload as SettlementReceipt);
  if (receipt.hash !== league.settlement_hash) throw new Error("Settlement receipt hash mismatch");
  const connection = vaultConnection(); await assertDevnet(connection);
  const state = await readVault(connection, id);
  if (!state?.funded || state.cancelled) throw new Error("Prize has not been escrowed");
  if (state.authority !== prizeAuthorityAddress().toBase58() || state.mint !== league.prize_mint) throw new Error("Escrow organizer or mint mismatch");
  if (state.finalized) {
    if (state.winner !== league.winner_wallet || state.settlementHash !== receipt.hash) throw new Error("Onchain result differs from settlement");
    return;
  }
  if (!PublicKey.isOnCurve(new PublicKey(league.winner_wallet))) throw new Error("Winner must be a signing wallet");
  const authority = prizeWallet();
  const signature = await sendAndConfirmTransaction(connection, new Transaction().add(await finalizeInstruction(id, authority.publicKey, new PublicKey(league.winner_wallet), Buffer.from(receipt.hash, "hex"))), [authority]);
  await q(`update leagues set vault_finalization_tx = $2 where id = $1`, [id, signature]);
}
export async function syncVaults() {
  if (!process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID || !process.env.PRIZE_AUTHORITY_SECRET) return;
  // Fund only the next round per series, keeping the organizer's token float bounded.
  const rows = await q<{ id: string; status: string }>(`select distinct on (series) id, status from leagues where status = 'upcoming' and starts_at > now() order by series, starts_at`);
  const done = await q<{ id: string; status: string }>(`select id, status from leagues where status = 'completed' and winner_wallet is not null and settlement_hash is not null and vault_finalization_tx is null`);
  for (const row of [...rows, ...done]) {
    try { if (row.status === "upcoming") await fundLeague(row.id); else await finalizeLeague(row.id); }
    catch (err) { await logJob("vault", false, `${row.id}: ${String(err)}`); }
  }
}
export async function cancelVault(id: string) {
  const connection = vaultConnection(); await assertDevnet(connection);
  const state = await readVault(connection, id);
  if (!state || state.cancelled) return;
  if (state.finalized) throw new Error("Finalized prizes cannot be cancelled");
  const authority = prizeWallet();
  await sendAndConfirmTransaction(connection, new Transaction().add(await payoutInstruction(id, authority.publicKey, new PublicKey(state.mint), true)), [authority]);
}

/** Only returns an unsigned transaction; the winner pays fees and signs in their own wallet. */
export async function prepareClaim(id: string, wallet: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "completed" || league.winner_wallet !== wallet) throw new Error("Only this round's winner can claim");
  const connection = vaultConnection(); await assertDevnet(connection);
  const state = await readVault(connection, id);
  if (!state?.funded || !state.finalized || state.cancelled || state.winner !== wallet || state.settlementHash !== league.settlement_hash || state.mint !== league.prize_mint || state.authority !== prizeAuthorityAddress().toBase58()) throw new Error("The prize is awaiting onchain settlement");
  if (state.claimed) throw new Error("Prize already claimed");
  const latest = await connection.getLatestBlockhash();
  const transaction = new Transaction({ feePayer: new PublicKey(wallet), ...latest }).add(await payoutInstruction(id, new PublicKey(wallet), new PublicKey(state.mint)));
  return { transaction: transaction.serialize({ requireAllSignatures: false }).toString("base64"), ...latest };
}
export async function recordClaim(id: string, wallet: string, signature: string) {
  const league = await getLeague(id);
  if (!league || league.status !== "completed" || league.winner_wallet !== wallet) throw new Error("Only this round's winner can record a claim");
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error("Invalid transaction signature");
  const connection = vaultConnection(); await assertDevnet(connection);
  const state = await readVault(connection, id);
  const transaction = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (!state?.claimed || state.winner !== wallet || state.settlementHash !== league.settlement_hash || state.mint !== league.prize_mint || state.authority !== prizeAuthorityAddress().toBase58() || !transaction || transaction.meta?.err) throw new Error("Claim has not confirmed yet");
  const keys = transaction.transaction.message.getAccountKeys();
  const discriminator = (await sha256("global:claim_prize")).subarray(0, 8);
  if (keys.get(0)?.toBase58() !== wallet || !transaction.transaction.message.compiledInstructions.some(ix => keys.get(ix.programIdIndex)?.toBase58() === state.program && Buffer.from(ix.data).equals(discriminator) && keys.get(ix.accountKeyIndexes[0])?.toBase58() === wallet && keys.get(ix.accountKeyIndexes[1])?.toBase58() === state.address)) throw new Error("Transaction does not claim this league's prize");
  await q(`insert into prize_claims (league_id, wallet, status, network, tx_signature, amount_raw) values ($1, $2, 'sent', 'devnet', $3, $4) on conflict (league_id) do update set status = 'sent', network = 'devnet', tx_signature = excluded.tx_signature, amount_raw = excluded.amount_raw, error = null, updated_at = now()`, [id, wallet, signature, state.amount]);
  return { status: "sent", tx: signature };
}
