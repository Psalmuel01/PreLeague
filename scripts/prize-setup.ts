// One-time devnet prize setup (NEXT_PUBLIC_PRIZE_NETWORK=devnet): creates (or reuses) a prize authority keypair,
// funds it with devnet SOL, creates a mock "SPACEX (devnet)" SPL mint and mints
// a prize float to the authority. Appends PRIZE_* vars to .env.local.
// Usage: npm run prize:setup
import { appendFileSync } from "node:fs";
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createMint, createMintToInstruction, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

const ENV = ".env.local";
const DECIMALS = 6;
const FLOAT_TOKENS = 1_000;

async function main() {
  if (process.env.NEXT_PUBLIC_PRIZE_NETWORK === "mainnet") {
    console.error("NEXT_PUBLIC_PRIZE_NETWORK is mainnet. This script only sets up devnet; use `npm run prize:wallet` for mainnet.");
    process.exit(1);
  }
  const connection = new Connection(process.env.PRIZE_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const existing = process.env.PRIZE_AUTHORITY_SECRET;
  const authority = existing ? Keypair.fromSecretKey(bs58.decode(existing)) : Keypair.generate();
  if (!existing) appendFileSync(ENV, `\nPRIZE_AUTHORITY_SECRET=${bs58.encode(authority.secretKey)}\n`);
  console.log("Prize authority:", authority.publicKey.toBase58());

  let balance = await connection.getBalance(authority.publicKey);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.log("Requesting devnet airdrop…");
    try {
      const sig = await connection.requestAirdrop(authority.publicKey, 0.5 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
    } catch (err) {
      console.error(
        `Airdrop failed (devnet faucet is rate-limited). Fund ${authority.publicKey.toBase58()} at https://faucet.solana.com and re-run.`,
      );
      throw err;
    }
    balance = await connection.getBalance(authority.publicKey);
  }
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");

  let mint = process.env.PRIZE_MINT ? new PublicKey(process.env.PRIZE_MINT) : null;
  if (!mint) {
    mint = await createMint(connection, authority, authority.publicKey, null, DECIMALS);
    appendFileSync(ENV, `PRIZE_MINT=${mint.toBase58()}\n`); // saved first, so a re-run reuses it
    console.log(`Created mock prize mint ${mint.toBase58()}`);
  } else {
    console.log("Prize mint:", mint.toBase58());
  }

  const ata = getAssociatedTokenAddressSync(mint, authority.publicKey);
  const held = await getAccount(connection, ata).then((a) => a.amount, () => null);
  if (held !== null && held > BigInt(0)) {
    console.log(`Prize float: ${Number(held) / 10 ** DECIMALS} tokens`);
    return;
  }
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(authority.publicKey, ata, authority.publicKey, mint),
    createMintToInstruction(mint, ata, authority.publicKey, BigInt(FLOAT_TOKENS) * BigInt(10 ** DECIMALS)),
  );
  await sendAndConfirmTransaction(connection, tx, [authority]);
  console.log(`Minted ${FLOAT_TOKENS} mock prize tokens to the prize wallet.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
