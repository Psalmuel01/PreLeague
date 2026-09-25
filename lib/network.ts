// Which Solana cluster prizes are paid on (NEXT_PUBLIC_PRIZE_NETWORK, default devnet).
// Readable on server and client.
export type PrizeNetwork = "devnet" | "mainnet";

export function prizeNetwork(): PrizeNetwork {
  return process.env.NEXT_PUBLIC_PRIZE_NETWORK === "mainnet" ? "mainnet" : "devnet";
}

export function explorerTx(sig: string, network: PrizeNetwork): string {
  return `https://explorer.solana.com/tx/${sig}${network === "devnet" ? "?cluster=devnet" : ""}`;
}

/** Appended to prize labels ("$25 in SpaceX PreStock") while prizes are paid in a devnet mock token. */
export const PRIZE_SUFFIX = prizeNetwork() === "mainnet" ? "" : " (devnet mock)";
