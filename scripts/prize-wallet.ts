// Shows the mainnet prize wallet: its address (fund this), SOL, PreStock
// balances, and whether each league's prize is covered. Usage: npm run prize:wallet
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync, getMint, getScaledUiAmountConfig } from "@solana/spl-token";
import { COMPANIES, COMPANY_BY_ID } from "../lib/companies";
import { LEAGUES } from "../lib/leagues";

async function main() {
  const secret = process.env.PRIZE_AUTHORITY_SECRET;
  if (!secret) {
    const kp = Keypair.generate();
    console.log("No PRIZE_AUTHORITY_SECRET set. A fresh prize wallet for you (add to .env.local and Vercel):");
    console.log(`PRIZE_AUTHORITY_SECRET=${bs58.encode(kp.secretKey)}`);
    console.log(`Address: ${kp.publicKey.toBase58()}`);
    return;
  }
  const wallet = Keypair.fromSecretKey(bs58.decode(secret)).publicKey;
  const connection = new Connection(process.env.PRIZE_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  console.log(`Prize wallet (mainnet): ${wallet.toBase58()}`);
  console.log(`SOL: ${(await connection.getBalance(wallet)) / LAMPORTS_PER_SOL}  (keep ≥ 0.0025 per claim for fees + the winner's token account)`);

  const prices: Record<string, number> = {};
  try {
    const api = (await (await fetch("https://prestocks.com/api/prestocks")).json()) as { symbol: string; tokenPrice: number }[];
    for (const a of api) prices[a.symbol] = a.tokenPrice;
  } catch {}

  const held: Record<string, number> = {};
  for (const c of COMPANIES) {
    const mintKey = new PublicKey(c.mint);
    const info = await connection.getAccountInfo(mintKey);
    const programId = info?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const mint = await getMint(connection, mintKey, "confirmed", programId);
    const scaled = getScaledUiAmountConfig(mint);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const mult = scaled ? (scaled.newMultiplierEffectiveTimestamp > BigInt(0) && now >= scaled.newMultiplierEffectiveTimestamp ? scaled.newMultiplier : scaled.multiplier) : 1;
    const raw = await getAccount(connection, getAssociatedTokenAddressSync(mintKey, wallet, false, programId), "confirmed", programId).then((a) => a.amount, () => BigInt(0));
    held[c.id] = (Number(raw) / 10 ** mint.decimals) * mult;
    if (raw > BigInt(0)) console.log(`  ${c.symbol.padEnd(11)} ${held[c.id].toFixed(6)}  ≈ $${(held[c.id] * (prices[c.symbol] ?? 0)).toFixed(2)}`);
  }
  console.log("\nLeague prizes (one winner each round):");
  for (const l of LEAGUES) {
    const c = COMPANY_BY_ID[l.prize.company];
    const valueHeld = held[c.id] * (prices[c.symbol] ?? 0);
    console.log(`  ${l.name.padEnd(24)} $${l.prize.usd} in ${c.name}  → ${valueHeld >= l.prize.usd ? "covered" : `NOT covered (hold $${valueHeld.toFixed(2)})`}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
