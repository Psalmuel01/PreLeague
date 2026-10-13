import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { ACCOUNT_SIZE, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { payoutInstruction } from "./vault";

/** Sponsor only the fee and recipient-account rent. The winner must still sign the vault claim. */
export async function buildClaimTransaction(connection: Connection, id: string, winner: PublicKey, mint: PublicKey, sponsor?: Keypair) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const payer = sponsor?.publicKey ?? winner;
  const destination = getAssociatedTokenAddressSync(mint, winner);
  const transaction = new Transaction({ feePayer: payer, ...latest });
  if (sponsor) transaction.add(createAssociatedTokenAccountIdempotentInstruction(payer, destination, winner, mint));
  transaction.add(await payoutInstruction(id, winner, mint));
  const [account, fee] = await Promise.all([
    connection.getAccountInfo(destination, "confirmed"),
    connection.getFeeForMessage(transaction.compileMessage(), "confirmed"),
  ]);
  if (fee.value === null) throw new Error("The claim preparation expired. Please try again.");
  const rent = account ? 0 : await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE, "confirmed");
  const requiredLamports = fee.value + rent;
  if (sponsor) {
    if (await connection.getBalance(payer, "confirmed") < requiredLamports) throw new Error("Demo fee sponsorship needs replenishing. Your prize is still escrowed; please try again shortly.");
    transaction.partialSign(sponsor);
  }
  return { transaction, feesSponsored: Boolean(sponsor), requiredLamports, ...latest };
}
