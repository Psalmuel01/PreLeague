"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { shortAddress, usd } from "@/lib/format";
import { useRound } from "@/lib/hooks/useRound";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { usePrices } from "@/components/providers/PriceProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Badge, Medal } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";

// The on-chain prize vault (create_league / settle / claim) is not deployed yet.
// Until NEXT_PUBLIC_PRIZE_VAULT_PROGRAM_ID is set, claiming is only simulated,
// and only in demo mode — the page says so rather than pretending.
const VAULT_PROGRAM = process.env.NEXT_PUBLIC_PRIZE_VAULT_PROGRAM_ID;

export function ClaimView({ slug, kickoff }: { slug: string; kickoff?: number }) {
  const league = LEAGUE_BY_SLUG[slug];
  const game = useGame();
  const { prices } = usePrices();
  const player = usePlayer();
  const view = useRound(league, kickoff ?? "last-final", { youName: player.displayName, youInitials: player.initials });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!game.ready || !view) {
    return (
      <Shell>
        <PageSkeleton height={300} />
      </Shell>
    );
  }

  const won = view.round.phase === "final" && view.you?.rank === 1;
  const prize = COMPANY_BY_ID[league.prize.company];
  const price = prices[prize.symbol];
  const tokens = price ? league.prize.usd / price : null;
  const claim = game.claims[view.key];
  const status = claim?.status ?? "ready";
  const canSimulate = !VAULT_PROGRAM && game.settings.demo;
  const wallet = view.entry?.wallet ?? player.address;

  function startClaim() {
    if (!canSimulate) return;
    game.setClaim(view!.key, { status: "pending", at: Date.now(), simulated: true });
    timer.current = setTimeout(() => {
      game.setClaim(view!.key, { status: "done", at: Date.now(), simulated: true });
    }, 2200);
  }

  if (!won) {
    return (
      <Shell>
        <main className="narrow stack" style={{ padding: "64px 0", gap: 16, textAlign: "center", alignItems: "center" }}>
          <h1 className="h-1">No prize to claim</h1>
          <p className="body">Only the winner of a finished round can claim its prize.</p>
          <Link className="btn btn-navy btn-lg" href={`/league/${slug}/results${kickoff ? `?round=${kickoff}` : ""}`}>
            Back to results
          </Link>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="narrow stack" style={{ padding: "40px 0 64px", gap: 20 }}>
        {status === "done" ? (
          <div role="status" className="stack center" style={{ alignItems: "center", gap: 12 }}>
            <Achv icon="trophy" tone="gold" className="pop" />
            <h1 className="h-1" style={{ fontSize: 48 }}>
              Prize claimed
            </h1>
            <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}>
              <p className="body">
                {prize.name} PreStock {claim?.simulated ? "claim simulated (demo mode)" : "was sent to your wallet"}.
              </p>
              <Badge kind="xp">+{100} XP</Badge>
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

        {status === "failed" && (
          <div className="banner banner-error" role="alert">
            <Icon name="warning" size="sm" />
            <span>We couldn’t submit your transaction. Your prize is still safe. Try again.</span>
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
                  <span className="mono-mark" style={{ color: prize.ink }}>
                    {prize.mono}
                  </span>
                </div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Your prize</span>
                <span className="h-2" style={{ fontSize: "clamp(28px, 4vw, 36px)" }}>
                  ${league.prize.usd} in {prize.name} PreStock
                </span>
              </div>
            </div>

            <div className="stack">
              <div className="kv">
                <span className="k">{status === "done" ? "Received" : "You’ll receive"}</span>
                <span className="v row" style={{ alignItems: "baseline", gap: 6 }}>
                  ≈ {tokens ? tokens.toFixed(4) : "—"}
                  <span className="ticker" style={{ color: "var(--navy-ink-2)" }}>
                    {prize.symbol}
                  </span>
                </span>
              </div>
              <div className="kv">
                <span className="k">Current value</span>
                <span className="v">{usd(league.prize.usd)}</span>
              </div>
              <div className="kv">
                <span className="k">{status === "done" ? "Sent to" : "Sending to"}</span>
                <span className="v row" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 13 }}>
                    {wallet ? shortAddress(wallet) : "Connect a wallet"}
                  </span>
                  {wallet && <span style={{ fontWeight: 500, color: "var(--navy-ink-2)" }}>(your wallet)</span>}
                </span>
              </div>
              <div className="kv">
                <span className="k">Network</span>
                <span className="v row" style={{ gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--navy-ink-2)" }} />
                  Solana
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
                      This usually takes a few seconds. You can leave this page.
                    </span>
                  </div>
                </div>
                <button className="btn btn-lime btn-lg btn-block" type="button" disabled>
                  Claiming…
                </button>
              </div>
            ) : status === "done" ? (
              <div className="stack" style={{ gap: 12 }}>
                <Link className="btn btn-lime btn-lg btn-block" href="/leagues">
                  Join another league
                </Link>
                <div className="cols-2">
                  <a className="btn btn-ghost-night" href={wallet ? `https://solscan.io/account/${wallet}` : "#"} target="_blank" rel="noreferrer">
                    View in wallet
                    <Icon name="external" size="sm" />
                  </a>
                  <a className="btn btn-ghost-night" href={`https://solscan.io/token/${prize.mint}`} target="_blank" rel="noreferrer">
                    View token
                    <Icon name="external" size="sm" />
                  </a>
                </div>
              </div>
            ) : canSimulate ? (
              <button className="btn btn-lime btn-lg btn-block" type="button" onClick={startClaim}>
                {status === "failed" ? "Try again" : "Claim prize (simulated)"}
              </button>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <div className="banner banner-info">
                  <Icon name="info" size="sm" />
                  <span>Your win is recorded. On-chain prize settlement opens once the PreLeague prize vault is live — the prize is paid to the wallet you played with.</span>
                </div>
                <button className="btn btn-lime btn-lg btn-block" type="button" disabled>
                  Claim opens at settlement
                </button>
              </div>
            )}
          </div>
        </section>

        {status === "done" && claim?.simulated && (
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="caption row" type="button" onClick={() => game.setClaim(view.key, { status: "failed", at: Date.now() })} style={{ minHeight: 36, padding: "0 10px", gap: 6, fontWeight: 700 }}>
              <Icon name="refresh" size="sm" />
              Replay
            </button>
          </div>
        )}
        <p className="caption center">Prizes are sent to the wallet you played with.</p>
      </div>
    </Shell>
  );
}
