"use client";
import { useState } from "react";
import type { RoundView } from "@/lib/hooks/useRound";
import { sha256 } from "@/lib/solana/vault";
import { explorerTx } from "@/lib/network";
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
}
export function VaultPanel({ view }: { view: RoundView }) {
  const [verified, setVerified] = useState<string | null>(null);
  const v = view.vault;
  return <section className="card stack" style={{ padding: 24, gap: 12, overflowWrap: "anywhere" }} aria-label="Verify on Solana">
    <h2 className="h-3">Verify on Solana</h2>
    <p className="small">{view.vaultError || (v?.funded && !v.cancelled ? "Prize funded ✓ · Escrowed on Solana Devnet" : "Prize escrow awaiting funding")}</p>
    <p className="small">{v?.finalized ? "League finalized ✓" : "Awaiting onchain finalization"}{v?.claimed ? " · Prize claimed ✓" : ""}</p>
    {v && <details><summary>Technical details</summary><div className="stack" style={{ gap: 10, paddingTop: 12 }}>
      <span>Winner: {v.finalized ? v.winner : "Pending"}</span>
      <span>Settlement hash: {v.finalized ? v.settlementHash : "Pending"}</span>
      <span>Escrowed token units: {v.amount}</span>
      <a href={`https://explorer.solana.com/address/${v.program}?cluster=devnet`} target="_blank" rel="noreferrer">Program: {v.program}</a>
      <a href={`https://explorer.solana.com/address/${v.address}?cluster=devnet`} target="_blank" rel="noreferrer">League: {v.address}</a>
      {v.fundingTx && <a href={explorerTx(v.fundingTx, "devnet")} target="_blank" rel="noreferrer">Funding transaction</a>}
      {v.finalizationTx && <a href={explorerTx(v.finalizationTx, "devnet")} target="_blank" rel="noreferrer">Settlement transaction</a>}
      {v.receipt && <><button className="btn btn-navy" onClick={async () => {
        const hash = (await sha256(canonical(v.receipt))).toString("hex");
        setVerified(v.finalized && hash === v.settlementHash ? "Receipt matches the onchain commitment ✓" : "Receipt is not committed onchain or does not match");
      }}>Verify receipt hash</button><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(v.receipt, null, 2)}</pre></>}
      {verified && <p role="status">{verified}</p>}
    </div></details>}
    <p className="caption">Market data and scoring run offchain. Solana holds prizes and records the settlement commitment. Devnet prizes use mock tokens.</p>
  </section>;
}
