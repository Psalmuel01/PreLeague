// Run via `anchor test --provider.cluster localnet` against a deployed local validator.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeInstruction, fundInstruction, finalizeInstruction, payoutInstruction, leagueAddress, readVault } from "../lib/solana/vault";

async function main() {
  const connection = new Connection(process.env.ANCHOR_PROVIDER_URL || "http://127.0.0.1:8899", "confirmed");
  // Never run destructive test fixtures on a public network.
  assert.match(connection.rpcEndpoint, /^http:\/\/(127\.0\.0\.1|localhost):/);
  const authority = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`, "utf8"))));
  const program = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync("target/deploy/preleague_vault-keypair.json", "utf8")))).publicKey;
  const winner = Keypair.generate(); const other = Keypair.generate();
  for (const wallet of [winner, other]) {
    const signature = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000);
    await connection.confirmTransaction(signature);
  }
  const mint = await createMint(connection, authority, authority.publicKey, null, 6);
  const wrongMint = await createMint(connection, authority, authority.publicKey, null, 6);
  const source = await getOrCreateAssociatedTokenAccount(connection, authority, mint, authority.publicKey);
  await mintTo(connection, authority, mint, source.address, authority, 10_000_000);
  const id = `test-${Date.now()}`; const amount = BigInt(1_000_000);
  const send = async (ix: Awaited<ReturnType<typeof fundInstruction>>, signer = authority) => sendAndConfirmTransaction(connection, new Transaction().add(ix), [signer]);
  const reject = async (name: string, operation: () => Promise<unknown>) => { await assert.rejects(operation); console.log(`✓ ${name}`); };
  await send(await initializeInstruction(id, authority.publicKey, mint, amount, program));
  const state = await readVault(connection, id, program);
  assert.equal(state?.amount, amount.toString()); assert.equal(state?.funded, false);
  console.log("✓ initialize league");
  await reject("cannot claim before finalization", async () => send(await payoutInstruction(id, winner.publicKey, mint, false, program), winner));
  await reject("invalid mint rejected", async () => send(await fundInstruction(id, authority.publicKey, wrongMint, program)));
  await send(await fundInstruction(id, authority.publicKey, mint, program));
  const address = (await leagueAddress(id, program)).address;
  const vault = getAssociatedTokenAddressSync(mint, address, true);
  assert.equal((await getAccount(connection, vault)).amount, amount);
  console.log("✓ fund prize");
  await reject("cannot double fund", async () => send(await fundInstruction(id, authority.publicKey, mint, program)));
  const hash = Buffer.alloc(32, 7);
  await reject("unauthorized account cannot set winner", async () => send(await finalizeInstruction(id, other.publicKey, winner.publicKey, hash, program), other));
  await reject("funded prize cannot be claimed before finalization", async () => send(await payoutInstruction(id, winner.publicKey, mint, false, program), winner));
  await send(await finalizeInstruction(id, authority.publicKey, winner.publicKey, hash, program));
  await reject("cannot change winner after finalization", async () => send(await finalizeInstruction(id, authority.publicKey, other.publicKey, hash, program)));
  await reject("wrong wallet cannot claim", async () => send(await payoutInstruction(id, other.publicKey, mint, false, program), other));
  await reject("cannot cancel finalized league", async () => send(await payoutInstruction(id, authority.publicKey, mint, true, program)));
  await send(await payoutInstruction(id, winner.publicKey, mint, false, program), winner);
  assert.equal((await getAccount(connection, getAssociatedTokenAddressSync(mint, winner.publicKey))).amount, amount);
  assert.equal((await readVault(connection, id, program))?.claimed, true);
  console.log("✓ winner can claim");
  await reject("cannot claim twice", async () => send(await payoutInstruction(id, winner.publicKey, mint, false, program), winner));
  const cancelId = `${id}-cancel`;
  await send(await initializeInstruction(cancelId, authority.publicKey, mint, amount, program));
  await send(await fundInstruction(cancelId, authority.publicKey, mint, program));
  const before = (await getAccount(connection, source.address)).amount;
  await send(await payoutInstruction(cancelId, authority.publicKey, mint, true, program));
  assert.equal((await getAccount(connection, source.address)).amount, before + amount);
  assert.equal((await readVault(connection, cancelId, program))?.cancelled, true);
  console.log("✓ cancel returns funds correctly");
  await reject("cancelled league cannot be funded", async () => send(await fundInstruction(cancelId, authority.publicKey, mint, program)));
}
main().catch(err => { console.error(err); process.exitCode = 1; });
