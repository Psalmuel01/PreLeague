"use client";

import Link from "next/link";
import { Buffer } from "buffer";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { assertDevnet, vaultConnection } from "@/lib/solana/vault";
import { VaultPanel } from "@/components/league/VaultPanel";
import { useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { shortAddress, usd } from "@/lib/format";
import { explorerTx, prizeNetwork, type PrizeNetwork } from "@/lib/network";
import { useRound } from "@/lib/hooks/useRound";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Badge, CoImg, Medal } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";


export function ClaimView({ slug, roundId }: { slug: string; roundId?: string }) {
  const league = LEAGUE_BY_SLUG[slug];
  const game = useGame();
  const wallet = useWallet();
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const player = usePlayer();
  const { view, loaded } = useRound(league, roundId ?? "last");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!game.ready || !loaded) {
    return (
      <Shell>
        <PageSkeleton height={300} />
      </Shell>
    );
  }

  const won = view?.status === "completed" && Boolean(view.you) && view.winnerWallet === view.you?.id;
  if (!view || !won) {
    return (
      <Shell>
        <div className="narrow stack" style={{ padding: "64px 0", gap: 16, textAlign: "center", alignItems: "center" }}>
          <h1 className="h-1">No prize to claim</h1>
          <p className="body">
            {player.signedIn ? "Only the winner of a settled round can claim its prize." : "Sign in with the wallet you played with to claim a prize."}
          </p>
          {!player.signedIn ? (
            <button className="btn btn-lime btn-lg" type="button" onClick={() => player.signIn()}>
              {player.connected ? "Sign in" : "Connect wallet"}
            </button>
          ) : (
            <Link className="btn btn-navy btn-lg" href={`/league/${slug}/results${roundId ? `?round=${roundId}` : ""}`}>
              Back to results
            </Link>
          )}
        </div>
      </Shell>
    );
  }

  const prize = COMPANY_BY_ID[view.prize.company];
  const tokens = view.vault ? Number(view.vault.amount) / 10 ** view.vault.decimals : null;
  const status = busy ? "pending" : view.vault?.claimed ? "sent" : view.claim?.status ?? "ready";
  const network = (view.claim?.network as PrizeNetwork | undefined) ?? prizeNetwork();
  const mainnet = network === "mainnet";

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      if (!wallet.publicKey || wallet.publicKey.toBase58() !== player.address || !wallet.signTransaction) throw new Error("Connect the wallet you played with");
      const connection = vaultConnection();
      await assertDevnet(connection);
      const res = await fetch(`/api/leagues/${view!.id}/claim`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Claim failed");
      const signed = await wallet.signTransaction(Transaction.from(Buffer.from(body.transaction, "base64")));
      const signature = await connection.sendRawTransaction(signed.serialize());
      setClaimTx(signature);
      const confirmed = await connection.confirmTransaction({ signature, blockhash: body.blockhash, lastValidBlockHeight: body.lastValidBlockHeight }, "confirmed");
      if (confirmed.value.err) throw new Error("Claim transaction failed");
      const recorded = await fetch(`/api/leagues/${view!.id}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signature }) });
      if (!recorded.ok) throw new Error((await recorded.json()).error ?? "Refresh to check your confirmed claim");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — try again.");
    } finally {
      await view!.refresh();
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="narrow stack" style={{ padding: "40px 0 64px", gap: 20 }}>
        {status === "sent" ? (
          <div role="status" className="stack center" style={{ alignItems: "center", gap: 12 }}>
            <Achv icon="trophy" tone="gold" className="pop" />
            <h1 className="h-1" style={{ fontSize: 48 }}>
              Prize claimed
            </h1>
            <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}>
              <p className="body">{mainnet ? `${prize.name} PreStock was sent to your wallet on Solana.` : `${prize.name} prize token was sent to your wallet on Solana devnet.`}</p>
              <Badge kind="xp">+100 XP</Badge>
            </div>
          </div>
        ) : (
          <div className="stack center" style={{ alignItems: "center", gap: 12 }}>
            <span className="eyebrow row" style={{ gap: 8, color: "var(--gold)" }}>
              <Medal rank={1} size={24} />
              {league.name} · You won
            </span>
            <h1 className="h-1 t-section">Claim your prize</h1>
          </div>
        )}

        {(error || status === "failed") && (
          <div className="banner banner-error" role="alert">
            <Icon name="warning" size="sm" />
            <span>{error ?? "The transfer didn’t go through. Your prize is still safe — try again."}</span>
          </div>
        )}

        <section className="card-night stack" style={{ overflow: "hidden", borderColor: "var(--gold-bg)", boxShadow: "0 6px 0 #B98A00, var(--shadow-3)" }} aria-label="Prize">
          <div className="row claim-strip">
            <Icon name="trophy" size="sm" />
            Winner · {league.name} · Round {view.round.round}
          </div>
          <div className="stack" style={{ padding: "22px 28px 24px", gap: 20 }}>
            <div className="row" style={{ gap: 18 }}>
              <div className="claim-medal">
                <div className="kit-shirt" style={{ background: prize.fill }}>
                  <CoImg id={prize.id} size={80} />
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Your prize</span>
                <span className="h-2" style={{ fontSize: "clamp(28px, 4vw, 36px)" }}>
                  ${view.prize.usd} in {prize.name} PreStock{mainnet ? "" : " (devnet mock)"}
                </span>
              </div>
            </div>

            <div className="stack">
              <div className="kv">
                <span className="k">{status === "sent" ? "Received" : "You’ll receive"}</span>
                <span className="v row" style={{ alignItems: "baseline", gap: 6 }}>
                  {tokens?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? "—"}
                  <span className="ticker" style={{ color: "var(--navy-ink-2)" }}>
                    {prize.symbol}{mainnet ? "" : " (devnet mock)"}
                  </span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Prize value when escrow funded</span>
                <span className="v">{usd(view.prize.usd)}</span>
              </div>
              <div className="kv">
                <span className="k">{status === "sent" ? "Sent to" : "Sending to"}</span>
                <span className="v row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 13 }}>
                    {player.address ? shortAddress(player.address) : "—"}
                  </span>
                  <span style={{ fontWeight: 500, color: "var(--navy-ink-2)" }}>(your wallet)</span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Network</span>
                <span className="v row" style={{ gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--navy-ink-2)" }} />
                  Solana {network}
                </span>
              </div>
            </div>

            {status === "pending" ? (
              <div className="stack" style={{ gap: 12 }}>
                <div role="status" className="row" style={{ borderRadius: 12, padding: "14px 16px", gap: 14, background: "var(--navy-2)", boxShadow: "inset 0 0 0 1px var(--navy-line)" }}>
                  <span className="spinner" />
                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Claiming your prize…</span>
                    <span className="small" style={{ color: "var(--navy-ink-2)" }}>
                      Sending the token on Solana. This usually takes a few seconds.
                    </span>
                  </div>
                </div>
                <button className="btn btn-lime btn-lg btn-block" type="button" disabled>
                  Claiming…
                </button>
              </div>
            ) : status === "sent" ? (
              <div className="stack" style={{ gap: 12 }}>
                <Link className="btn btn-lime btn-lg btn-block" href="/leagues">
                  Join another league
                </Link>
                {(claimTx || view.claim?.tx) && (
                  <a className="btn btn-ghost-night" href={explorerTx(claimTx || view.claim!.tx!, "devnet")} target="_blank" rel="noreferrer">
                    View transaction
                    <Icon name="external" size="sm" />
                  </a>
                )}
              </div>
            ) : (
              <button className="btn btn-lime btn-lg btn-block" type="button" disabled={!view.vault?.finalized || !view.vault?.funded || view.vault?.cancelled} onClick={claim}>
                {status === "failed" ? "Try again" : "Claim prize"}
              </button>
            )}
          </div>
        </section>

        <VaultPanel view={view} />
        <p className="caption center">
          {mainnet
            ? `Paid in real ${prize.name} PreStock on Solana mainnet, to the wallet you played with. PreStocks withholds a small transfer fee (1–3%) from token transfers.`
            : `Hackathon build: claim a mock ${prize.symbol} token escrowed on Solana Devnet. The amount is fixed at funding; its displayed USD value can change. Your wallet pays Devnet transaction fees.`}
        </p>
      </div>
    </Shell>
  );
}
