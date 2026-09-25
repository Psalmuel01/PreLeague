// Which Solana cluster prizes are paid on. Readable on server and client.
export type PrizeNetwork = "devnet" | "mainnet";

export function prizeNetwork(): PrizeNetwork {
  return process.env.NEXT_PUBLIC_PRIZE_NETWORK === "mainnet" ? "mainnet" : "devnet";
}

export function explorerTx(sig: string, network: PrizeNetwork): string {
  return `https://explorer.solana.com/tx/${sig}${network === "devnet" ? "?cluster=devnet" : ""}`;
}
