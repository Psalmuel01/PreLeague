"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { useRound } from "@/lib/hooks/useRound";
import { usd } from "@/lib/format";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { usePrices } from "@/components/providers/PriceProvider";
import { MobileBarTitle } from "@/components/shell/MobileBarTitle";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Clock, CoImg, CoLogo, Delta } from "@/components/ui/bits";
import { Icon } from "@/components/ui/Icon";
import { Pitch } from "@/components/ui/Pitch";

const HELPERS = [
  "Choose three companies to fill your squad.",
  "Two more picks to go.",
  "One more pick to complete your squad.",
  "Squad full — remove a pick to swap.",
];

export function DraftView({ slug, edit = false }: { slug: string; edit?: boolean }) {
  const league = LEAGUE_BY_SLUG[slug];
  const router = useRouter();
  const game = useGame();
  const { prices, marks } = usePrices();
  const player = usePlayer();
  const { view, loaded } = useRound(league, "next");
  const [trayOpen, setTrayOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const round = view?.round ?? null;
  const key = view?.id ?? "";
  const entry = view?.entry ?? null;

  // Already locked for this round: go to the team sheet (unless editing before kick-off).
  useEffect(() => {
    if (entry && !edit) router.replace(`/league/${slug}/locked`);
  }, [entry, edit, router, slug]);

  if (!game.ready || !loaded || (entry && !edit)) {
    return (
      <Shell tabs={false}>
        <PageSkeleton height={268} />
      </Shell>
    );
  }

  if (!round || !view) {
    return (
      <Shell>
        <section className="band band-pad">
          <div className="container stack" style={{ gap: 16 }}>
            <h1 className="h-1 t-page">Drafting closed</h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)" }}>
              {league.name} has no open round right now.
            </p>
            <Link className="btn btn-lime btn-lg" href="/leagues" style={{ alignSelf: "flex-start" }}>
              Find another league
            </Link>
          </div>
        </section>
      </Shell>
    );
  }

  const picks = game.drafts[key] ?? entry?.picks ?? [];
  const n = picks.length;
  const full = n >= 3;
  const toggle = (id: CompanyId) => {
    setError(null);
    if (picks.includes(id)) game.setDraft(key, picks.filter((p) => p !== id));
    else if (picks.length < 3) game.setDraft(key, [...picks, id]);
  };
  const lockHint = full ? "Free entry · You never buy what you draft." : `Pick ${3 - n} more to lock your lineup.`;

  async function lock() {
    if (!full || locking) return;
    setError(null);
    if (!player.signedIn) {
      // Connect (if needed) and sign in; the player taps Lock again once signed in.
      await player.signIn();
      return;
    }
    setLocking(true);
    try {
      const res = await fetch(`/api/leagues/${key}/lineup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ picks }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn’t lock your lineup");
      await view!.refresh();
      router.push(`/league/${slug}/locked`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLocking(false);
    }
  }

  const slots = [0, 1, 2].map((i) => ({ id: picks[i] ?? null, value: picks[i] ? "33.3%" : undefined }));
  const lockLabel = player.signingIn
    ? "Check your wallet…"
    : !player.connected && !player.signedIn
      ? "Connect wallet to lock"
      : !player.signedIn
        ? "Sign in to lock"
        : locking
          ? "Locking…"
          : entry
            ? "Save lineup"
            : "Lock lineup";

  const lockButton = (block = true) =>
    full ? (
      <button type="button" className={`btn btn-lime btn-lg ${block ? "btn-block" : ""}`} onClick={lock} disabled={locking || player.signingIn}>
        <Icon name={player.signedIn ? "lock" : "wallet"} strokeWidth={2.4} />
        {lockLabel}
      </button>
    ) : (
      <button type="button" className={`btn btn-lg ${block ? "btn-block" : ""}`} disabled>
        <Icon name="lock" />
        {n === 2 ? "Pick 1 more to lock" : `Pick ${3 - n} more to lock`}
      </button>
    );

  return (
    <Shell
      tabs={false}
      footer={false}
      mobileBar={
        <>
          <Link className="icon-btn" href={`/league/${slug}`} aria-label="Close draft" style={{ color: "#fff", marginLeft: -12 }}>
            <Icon name="close" />
          </Link>
          <MobileBarTitle title={league.name} sub={`Draft · Round ${round.round}`} />
          <span className="spacer" />
          <span className="eyebrow" style={{ fontSize: 11, lineHeight: 1.1, color: "var(--navy-ink-2)", textAlign: "right" }}>
            Lock
            <br />
            in
          </span>
          <Clock ms={round.remaining} variant="sm" label="Lineups lock in" role="timer" />
        </>
      }
    >
      <section className="band hide-sm" style={{ padding: "30px 0 72px" }}>
        <span className="band-slash" style={{ right: -70, width: 200 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 170, opacity: 0.9 }} aria-hidden="true" />
        <div className="container row wrap" style={{ position: "relative", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
          <div className="stack" style={{ gap: 14 }}>
            <Link href={`/league/${slug}`} className="row" style={{ gap: 4, fontSize: 14, fontWeight: 700, color: "var(--navy-ink-2)", alignSelf: "flex-start" }}>
              <Icon name="chevronLeft" size="sm" />
              {league.name} · Round {round.round}
            </Link>
            <h1 className="h-1 t-page" style={{ fontSize: "clamp(48px, 5.6vw, 80px)" }}>
              Pick your <span className="hl">3</span>
            </h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 600 }}>
              Choose three companies you think will outperform this round. Every pick counts equally.
            </p>
          </div>
          <div className="stack" style={{ gap: 10, paddingTop: 24, marginRight: "clamp(0px, 8vw, 120px)" }}>
            <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
              Deadline in
            </span>
            <Clock ms={round.remaining} variant="lg" label="Deadline in" role="timer" />
            <span className="caption">Squads lock at the deadline</span>
          </div>
        </div>
      </section>

      {/* Small screens: squad pitch + title instead of the band */}
      <section className="show-sm container" style={{ paddingTop: 12 }}>
        <Pitch height={146} mini slots={slots} layout="row" colGap={22} />
        <div className="row" style={{ alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "16px 0 14px" }}>
          <div className="stack" style={{ gap: 4 }}>
            <h1 className="h-2" style={{ fontSize: 36 }}>
              Pick your <span className="hl">3</span>
            </h1>
            <p className="caption" style={{ fontSize: 13 }}>
              Equal weight · 33.3% each
            </p>
          </div>
          <span className="fig-m num" aria-label={`${n} of 3 picked`}>
            {n}
            <span style={{ color: "var(--ink-3)", fontSize: 20 }}> / 3</span>
          </span>
        </div>
      </section>

      <div className="draft-main">
        <div className="container split" style={{ "--side": "400px", "--gap": "40px" } as React.CSSProperties}>
          <section aria-label="Draft pool" className="draft-grid">
            {league.pool.map((id) => {
              const c = COMPANY_BY_ID[id];
              const idx = picks.indexOf(id);
              const sel = idx >= 0;
              const off = !sel && full;
              const price = prices[c.symbol];
              const mark = marks[c.symbol];
              return (
                <article key={id} className={["draft-card", sel ? "selected" : "", off ? "off" : ""].join(" ")} style={{ padding: 18, gap: 14 }}>
                  {sel && (
                    <span className="pick-no pop" aria-label={`Pick ${idx + 1}`}>
                      {idx + 1}
                    </span>
                  )}
                  <div className="row" style={{ alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <span className="kit-shirt draft-shirt" style={{ background: c.fill }} aria-hidden="true">
                      <CoImg id={c.id} size={64} />
                    </span>
                    {price && mark ? (
                      <span className="stack" style={{ alignItems: "flex-end", gap: 4 }} title="Token price premium over the PreStocks mark price">
                        <span className="cd-label" style={{ fontSize: 12 }}>
                          vs mark
                        </span>
                        <Delta value={price / mark - 1} className="delta-pill" digits={1} />
                      </span>
                    ) : (
                      <span className="ticker" style={{ paddingTop: 4 }}>
                        {c.symbol}
                      </span>
                    )}
                  </div>
                  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <h3 className="title">{c.name}</h3>
                    <span className="small faint draft-desc">{c.desc}</span>
                  </div>
                  <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                    <span className="num" style={{ fontSize: 15, fontWeight: 700 }}>
                      {price ? usd(price) : "—"}
                    </span>
                    <span className="ticker hide-sm">{c.symbol}</span>
                  </div>
                  {sel ? (
                    <button type="button" className="draft-btn on" aria-pressed="true" aria-label={`${c.name} selected, remove from squad`} onClick={() => toggle(id)}>
                      <Icon name="check" size="sm" strokeWidth={2.6} />
                      Selected
                    </button>
                  ) : off ? (
                    <button type="button" className="draft-btn" disabled aria-label={`Draft ${c.name} unavailable, squad full`}>
                      Squad full
                    </button>
                  ) : (
                    <button type="button" className="draft-btn" aria-pressed="false" aria-label={`Draft ${c.name}`} onClick={() => toggle(id)}>
                      <Icon name="plus" size="sm" strokeWidth={2.6} />
                      Draft
                    </button>
                  )}
                </article>
              );
            })}
          </section>

          <aside className="card hide-md" aria-label="Your squad" style={{ overflow: "hidden", position: "sticky", top: 88 }}>
            <div className="card-head">
              <span>Your squad</span>
              <span className="spacer" />
              <span className="num" style={{ color: "var(--lime)" }} aria-live="polite">
                {n} / 3
              </span>
            </div>
            <div className="stack" style={{ padding: 16, gap: 16 }}>
              <Pitch height={330} slots={slots} colGap={60} rowGap={30} pop onRemove={toggle} />
              <div className="stack" style={{ gap: 8 }} aria-live="polite">
                <div className="row" style={{ alignItems: "baseline", justifyContent: "space-between" }}>
                  <span className="fig-s">{n} / 3 picked</span>
                  <span className="caption row" style={{ gap: 6 }}>
                    <Icon name="sliders" size="sm" />
                    33.3% each · equal weight
                  </span>
                </div>
                <div className="steps3" aria-hidden="true">
                  {[1, 2, 3].map((s) => (
                    <span key={s} className={n >= s ? "on" : ""} />
                  ))}
                </div>
                <span className="small muted">{HELPERS[n]}</span>
              </div>
              <div className="card-sunken" style={{ padding: "2px 14px", borderRadius: 12 }}>
                <div className="kv">
                  <span className="k">League</span>
                  <span className="v">{league.name}</span>
                </div>
                <div className="kv">
                  <span className="k">Deadline in</span>
                  <span className="v">
                    <Clock ms={round.remaining} label="Deadline in" variant="card-sm" />
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Prize</span>
                  <span className="v row" style={{ gap: 8 }}>
                    <CoLogo id={league.prize.company} size="xs" />${league.prize.usd} in {COMPANY_BY_ID[league.prize.company].name} PreStock
                  </span>
                </div>
              </div>
              <div className="banner banner-warn" style={{ padding: "10px 14px", fontSize: 13.5 }}>
                <Icon name="lock" size="sm" />
                Your squad can’t be changed after the deadline.
              </div>
              {(error ?? player.error) && (
                <div className="banner banner-error" role="alert" style={{ fontSize: 13.5 }}>
                  <Icon name="warning" size="sm" />
                  {error ?? player.error}
                </div>
              )}
              <div className="stack" style={{ gap: 8 }}>
                {lockButton()}
                <span className="caption center">{player.signedIn ? lockHint : "You’ll sign a message to prove it’s your wallet. No transaction, no fee."}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Small screens: sticky tray + review sheet */}
      <div className="tray">
        <button type="button" onClick={() => setTrayOpen(true)} aria-label={`Review squad, ${n} of 3 picked`} className="row" style={{ flexGrow: 1, minWidth: 0, height: 56, gap: 12, padding: "0 6px", textAlign: "left" }}>
          <span className="logos">
            {picks.map((p) => (
              <CoLogo key={p} id={p} size="sm" />
            ))}
            {Array.from({ length: 3 - n }).map((_, i) => (
              <span key={i} className="logo logo-sm" style={{ background: "var(--surface)", border: "1.5px dashed var(--line-2)", boxShadow: "none" }} />
            ))}
          </span>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <span className="fig-s num" style={{ fontSize: 22 }}>
              {n} / 3
            </span>
            <span className="caption" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {full ? "Squad ready · 33.3% each" : `Pick ${3 - n} more`}
            </span>
          </span>
        </button>
        {full ? (
          <button type="button" className="btn btn-lime" onClick={() => setTrayOpen(true)} style={{ height: 50, padding: "0 16px", flexShrink: 0 }}>
            <Icon name="lock" size="sm" />
            Lock lineup
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setTrayOpen(true)} style={{ height: 50, padding: "0 16px", flexShrink: 0 }}>
            Review
            <Icon name="chevronUp" size="sm" />
          </button>
        )}
      </div>

      {trayOpen && (
        <>
          <div className="pl-scrim" onClick={() => setTrayOpen(false)} aria-hidden="true" />
          <section className="pl-sheet stack" role="dialog" aria-modal="true" aria-label="Your squad" style={{ gap: 14 }}>
            <div className="grabber" />
            <div className="row" style={{ gap: 8 }}>
              <div className="stack" style={{ gap: 4, flexGrow: 1 }}>
                <h2 className="h-3" style={{ fontSize: 26 }}>
                  Your squad
                </h2>
                <span className="caption num" style={{ fontWeight: 600 }}>
                  {n} / 3 picked · 33.3% each
                </span>
              </div>
              <button type="button" className="icon-btn" aria-label="Collapse squad" onClick={() => setTrayOpen(false)} style={{ background: "var(--sunken)", borderRadius: "50%", color: "var(--navy)" }}>
                <Icon name="chevronDown" />
              </button>
            </div>
            <div className="steps3" aria-hidden="true">
              {[1, 2, 3].map((s) => (
                <span key={s} className={n >= s ? "on" : ""} />
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {[0, 1, 2].map((i) => {
                const id = picks[i];
                if (!id)
                  return (
                    <button key={i} type="button" className="slot empty" onClick={() => setTrayOpen(false)} style={{ height: 64, width: "100%", fontSize: 14.5, fontWeight: 700, textAlign: "left" }}>
                      <span className="slot-no">{i + 1}</span>
                      <span style={{ flexGrow: 1 }}>Pick one more company</span>
                      <Icon name="plus" size="sm" />
                    </button>
                  );
                const c = COMPANY_BY_ID[id];
                return (
                  <div key={id} className="slot" style={{ height: 64, paddingRight: 4 }}>
                    <span className="slot-no">{i + 1}</span>
                    <CoLogo id={id} />
                    <span className="stack" style={{ flexGrow: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{c.name}</span>
                      <span className="ticker">{c.symbol}</span>
                    </span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>
                      33.3%
                    </span>
                    <button type="button" className="icon-btn" aria-label={`Remove ${c.name}`} onClick={() => toggle(id)} style={{ color: "var(--ink-3)" }}>
                      <Icon name="close" size="sm" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="banner banner-warn" style={{ fontSize: 13.5 }}>
              <Icon name="lock" size="sm" />
              <span>Your squad can’t be changed after the league starts.</span>
            </div>
            {(error ?? player.error) && (
              <div className="banner banner-error" role="alert" style={{ fontSize: 13.5 }}>
                <Icon name="warning" size="sm" />
                {error ?? player.error}
              </div>
            )}
            {lockButton()}
            {!player.signedIn && <span className="caption center">You’ll sign a message to prove it’s your wallet. No transaction, no fee.</span>}
          </section>
        </>
      )}
    </Shell>
  );
}
