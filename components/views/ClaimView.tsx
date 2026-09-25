"use client";

import Link from "next/link";
import { useState } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { shortAddress, usd } from "@/lib/format";
import { explorerTx } from "@/lib/network";
import { useRound } from "@/lib/hooks/useRound";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Badge, CoImg, Medal } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";


export function ClaimView({ slug, roundId }: { slug: string; roundId?: string }) {
  const league = LEAGUE_BY_SLUG[slug];
  const game = useGame();
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

  const won = view?.status === "completed" && view.you?.rank === 1;
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
  const settlePrice = view.boundary.end?.[prize.symbol];
  const tokens = settlePrice ? view.prize.usd / settlePrice : null;
  const status = busy ? "pending" : view.claim?.status ?? "ready";

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leagues/${view!.id}/claim`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Claim failed");
    } catch {
      setError("Network error — try again.");
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
              <p className="body">{prize.name} PreStock was sent to your wallet on Solana.</p>
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
                  ${view.prize.usd} in {prize.name} PreStock
                </span>
              </div>
            </div>

            <div className="stack">
              <div className="kv">
                <span className="k">{status === "sent" ? "Received" : "You’ll receive"}</span>
                <span className="v row" style={{ alignItems: "baseline", gap: 6 }}>
                  ≈ {tokens ? tokens.toFixed(4) : "—"}
                  <span className="ticker" style={{ color: "var(--navy-ink-2)" }}>
                    {prize.symbol}
                  </span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Value at settlement</span>
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
                  Solana mainnet
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
                {view.claim?.tx && (
                  <a className="btn btn-ghost-night" href={explorerTx(view.claim.tx)} target="_blank" rel="noreferrer">
                    View transaction
                    <Icon name="external" size="sm" />
                  </a>
                )}
              </div>
            ) : (
              <button className="btn btn-lime btn-lg btn-block" type="button" onClick={claim}>
                {status === "failed" ? "Try again" : "Claim prize"}
              </button>
            )}
          </div>
        </section>

        <p className="caption center">
          Paid in real {prize.name} PreStock on Solana mainnet, to the wallet you played with. PreStocks withholds a small transfer fee (1–3%) from token transfers.
        </p>
      </div>
    </Shell>
  );
}
