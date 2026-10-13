// Public Devnet contract proof with an explicitly synthetic settlement fixture.
// This does not claim to exercise live market scoring or an organic player.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import bs58 from "bs58";
import { Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assertDevnet, vaultConnection, vaultProgram, initializeInstruction, fundInstruction, finalizeInstruction, payoutInstruction, readVault } from "../lib/solana/vault";
import { settlementReceipt } from "../lib/solana/receipt";
async function main() {
  const connection = vaultConnection(); await assertDevnet(connection);
  const authority = Keypair.fromSecretKey(bs58.decode(process.env.PRIZE_AUTHORITY_SECRET!));
  const mint = new PublicKey(process.env.PRIZE_MINT!);
  const winner = Keypair.generate();
  const id = `vault-verification-${Date.now()}`;
  const amount = BigInt(1_000_000);
  const send = (tx: Transaction, signer = authority) => sendAndConfirmTransaction(connection, tx, [signer]);
  const fundingTx = await send(new Transaction().add(await initializeInstruction(id, authority.publicKey, mint, amount), await fundInstruction(id, authority.publicKey, mint)));
  const funded = await readVault(connection, id);
  if (!funded?.funded) throw new Error("Funding was not verified");
  console.log("Prize escrow funded:", fundingTx);
  const timestamp = new Date().toISOString();
  const receipt = settlementReceipt({ leagueId: id, round: 1, startsAt: timestamp, endsAt: timestamp, startPrices: { FIXTURE: 100 }, endPrices: { FIXTURE: 101 }, winningWallet: winner.publicKey.toBase58(), winningScore: 0.01, settledAt: timestamp });
  const settlementTx = await send(new Transaction().add(await finalizeInstruction(id, authority.publicKey, winner.publicKey, Buffer.from(receipt.hash, "hex"))));
  await send(new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: winner.publicKey, lamports: 10_000_000 })));
  const claimTx = await send(new Transaction().add(await payoutInstruction(id, winner.publicKey, mint)), winner);
  const state = await readVault(connection, id);
  const destination = await getAccount(connection, getAssociatedTokenAddressSync(mint, winner.publicKey));
  if (!state?.claimed || !state.finalized || state.winner !== winner.publicKey.toBase58() || state.settlementHash !== receipt.hash || destination.amount !== amount) throw new Error("Devnet verification failed");
  const deployment = JSON.parse(readFileSync("docs/devnet-deployment.json", "utf8"));
  const currentHash = createHash("sha256").update(readFileSync("target/deploy/preleague_vault.so")).digest("hex");
  if (deployment.binarySha256 !== currentHash) throw new Error("Local binary changed since deployment");
  writeFileSync("docs/devnet-vault-proof.json", JSON.stringify({ source: "synthetic contract verification fixture; not live scoring or an organic player", program: vaultProgram().toBase58(), leagueId: id, fundingTx, settlementTx, claimTx, receipt, state, receivedRaw: destination.amount.toString() }, null, 2) + "\n");
  console.log("Winner-signed claim verified:", `https://explorer.solana.com/tx/${claimTx}?cluster=devnet`);
}
main().catch(err => { console.error(err); process.exitCode = 1; });
