// One-time devnet prize setup: creates (or reuses) a prize authority keypair,
// funds it with devnet SOL, creates a mock "SPACEX (devnet)" SPL mint and mints
// a prize float to the authority. Appends PRIZE_* vars to .env.local.
// Usage: npm run prize:setup
import { appendFileSync, readFileSync } from "node:fs";
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

const ENV = ".env.local";
const DECIMALS = 6;
const FLOAT_TOKENS = 1_000;

async function main() {
  const connection = new Connection(process.env.SOLANA_DEVNET_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const existing = process.env.PRIZE_AUTHORITY_SECRET;
  const authority = existing ? Keypair.fromSecretKey(bs58.decode(existing)) : Keypair.generate();
  if (!existing) appendFileSync(ENV, `\nPRIZE_AUTHORITY_SECRET=${bs58.encode(authority.secretKey)}\n`);
  console.log("Prize authority:", authority.publicKey.toBase58());

  let balance = await connection.getBalance(authority.publicKey);
  if (balance < 0.2 * LAMPORTS_PER_SOL) {
    console.log("Requesting devnet airdrop…");
    try {
      const sig = await connection.requestAirdrop(authority.publicKey, 1 * LAMPORTS_PER_SOL);
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

  if (process.env.PRIZE_MINT) {
    console.log("Prize mint already configured:", process.env.PRIZE_MINT);
    return;
  }
  const mint = await createMint(connection, authority, authority.publicKey, null, DECIMALS);
  const ata = await getOrCreateAssociatedTokenAccount(connection, authority, mint, authority.publicKey);
  await mintTo(connection, authority, mint, ata.address, authority, BigInt(FLOAT_TOKENS) * BigInt(10 ** DECIMALS));
  appendFileSync(ENV, `PRIZE_MINT=${mint.toBase58()}\n`);
  console.log(`Created mock prize mint ${mint.toBase58()} and minted ${FLOAT_TOKENS} tokens.`);
  console.log(`Wrote PRIZE_* to ${ENV}:\n${readFileSync(ENV, "utf8").split("\n").filter((l) => l.startsWith("PRIZE_MINT")).join("\n")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
