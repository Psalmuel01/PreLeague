"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { COMPANY_BY_ID } from "@/lib/companies";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { useRound } from "@/lib/hooks/useRound";
import { EARLY_BIRD_MS, XP } from "@/lib/standings";
import { shareText } from "@/lib/share";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { PageSkeleton, Shell } from "@/components/shell/Shell";
import { Achv, Clock, CoLogo } from "@/components/ui/bits";
import { Icon, LogoMark } from "@/components/ui/Icon";
import { Pitch } from "@/components/ui/Pitch";

export function LockedView({ slug }: { slug: string }) {
  const league = LEAGUE_BY_SLUG[slug];
  const router = useRouter();
  const { ready } = useGame();
  const player = usePlayer();
  const next = useRound(league, "next");
  const live = useRound(league, "live");

  // Your squad for the round still to start, else the one now in play.
  const view = next.view?.entry ? next.view : live.view?.entry ? live.view : null;
  const round = view?.round ?? null;
  const entry = view?.entry ?? null;
  const loaded = next.loaded && live.loaded;

  useEffect(() => {
    if (ready && loaded && !entry) router.replace(`/league/${slug}`);
  }, [ready, loaded, entry, router, slug]);

  if (!ready || !round || !entry) {
    return (
      <Shell>
        <PageSkeleton height={620} />
      </Shell>
    );
  }

  const isLive = round.phase === "live";
  const earlyBird = entry.lockedAt <= round.kickoff - EARLY_BIRD_MS;
  const slots = entry.picks.map((id) => ({ id, value: "33.3%" as const }));
  const names = entry.picks.map((p) => COMPANY_BY_ID[p].name);
  const share = () =>
    shareText(`My ${league.name} lineup: ${names.join(" · ")}. Think you can beat it?`, `/league/${slug}`);

  return (
    <Shell>
      <section className="band band-pad" style={{ paddingBottom: 96 }}>
        <span className="band-slash" style={{ right: -60, width: 220 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 200, opacity: 0.9 }} aria-hidden="true" />
        <div className="container split" style={{ position: "relative", "--side": "500px", "--gap": "64px", "--align": "center" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 26 }}>
            <div className="row" style={{ gap: 16 }}>
              <span className="pop locked-check" aria-hidden="true">
                <Icon name="check" style={{ width: 34, height: 34 }} strokeWidth={2.8} />
              </span>
              <div className="stack" style={{ gap: 6 }}>
                <span className="badge badge-locked" style={{ alignSelf: "flex-start", background: "var(--navy-3)" }}>
                  <Icon name="lock" style={{ width: 14, height: 14 }} />
                  Locked
                </span>
                <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 16 }}>
                  {league.name} · Round {round.round}
                </span>
              </div>
            </div>
            <h1 className="h-hero t-hero">
              Squad <span className="hl">locked.</span>
            </h1>
            <p className="lead" style={{ color: "var(--navy-ink-2)", maxWidth: 540 }}>
              {isLive
                ? "The round is live. Your picks are moving with the market — best average return takes the prize."
                : "You’re in. When the round starts, your picks move with the market — best average return takes the prize."}
            </p>
            <div className="row wrap" style={{ alignItems: "flex-end", gap: 28 }}>
              <div className="stack" style={{ gap: 10 }}>
                <span className="cd-label" style={{ color: "var(--navy-ink-2)" }}>
                  {isLive ? "Time left" : "League starts in"}
                </span>
                <Clock ms={round.remaining} variant="lg" label={isLive ? "Time left" : "League starts in"} role="timer" />
              </div>
              <div className="row wrap" style={{ gap: 12, paddingBottom: 3 }}>
                <Link className="btn btn-lime btn-lg" href={`/league/${slug}/${isLive ? "live" : ""}`}>
                  {isLive ? "Watch live" : "View league"}
                </Link>
                {!isLive && (
                  <Link className="btn btn-ghost-night btn-lg" href={`/league/${slug}/draft?edit=1`}>
                    Edit lineup
                  </Link>
                )}
                <button type="button" className="btn btn-ghost-night btn-lg" onClick={share}>
                  <Icon name="share" />
                  Share lineup
                </button>
              </div>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <Pitch
              height={440}
              slots={slots}
              padTop={36}
              rowGap={30}
              tag={
                <span className="badge">
                  <Icon name="lock" style={{ width: 14, height: 14 }} />
                  Your squad · locked
                </span>
              }
              style={{ boxShadow: "0 8px 0 #146236, 0 30px 60px -20px rgba(0,0,0,.6)" }}
              className="locked-pitch"
            />
            {earlyBird && (
              <div className="card pop row early-toast" role="status">
                <Achv icon="clock" tone="blue" />
                <div className="stack" style={{ gap: 3 }}>
                  <span className="row" style={{ alignItems: "baseline", gap: 10 }}>
                    <span className="fig-m" style={{ color: "var(--blue)" }}>
                      +{XP.earlyBird} XP
                    </span>
                    <span className="h-3" style={{ fontSize: 22 }}>
                      Early bird
                    </span>
                  </span>
                  <span className="small muted">Locked 5+ minutes before the deadline.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ padding: "88px 0 80px" }}>
        <div className="container split-left" style={{ "--side": "340px", "--gap": "64px", alignItems: "center" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 16 }}>
            <span className="eyebrow row" style={{ gap: 8 }}>
              <Icon name="share" size="sm" />
              Share preview
            </span>
            <h2 className="h-2 t-h2">Your team sheet</h2>
            <p className="body">This is what friends see when you share your lineup. Post it and dare the room to beat it.</p>
            <button type="button" className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={share}>
              <Icon name="share" size="sm" />
              Share lineup
            </button>
          </div>

          <figure style={{ margin: 0 }}>
            <div className="share-card team-sheet" aria-label={`Share card preview: ${player.displayName}’s squad for ${league.name}`}>
              <div className="stack" style={{ position: "relative", padding: "30px 34px", gap: 18 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="wordmark" style={{ fontSize: 20, gap: 8 }}>
                    <LogoMark size={22} />
                    <span>
                      <i>Pre</i>League
                    </span>
                  </span>
                  <span className="badge badge-joined">Team sheet</span>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="h-2" style={{ fontSize: "clamp(32px, 4vw, 44px)" }}>
                    {player.displayName}’s squad
                  </span>
                  <span className="eyebrow">
                    {league.name} · Round {round.round}
                  </span>
                </div>
                <ol className="stack" style={{ gap: 8 }}>
                  {entry.picks.map((id, i) => {
                    const c = COMPANY_BY_ID[id];
                    return (
                      <li key={id} className="row" style={{ gap: 12, height: 36 }}>
                        <span className="slot-no" style={{ background: "var(--lime)", color: "var(--navy)" }}>
                          {i + 1}
                        </span>
                        <CoLogo id={id} size="sm" style={{ boxShadow: "0 0 0 1px var(--navy-line)" }} />
                        <span style={{ fontWeight: 700, flexGrow: 1 }}>{c.name}</span>
                        <span className="ticker hide-sm" style={{ color: "var(--navy-ink-2)" }}>
                          {c.symbol}
                        </span>
                        <span className="num" style={{ fontWeight: 700, width: 52, textAlign: "right" }}>
                          33.3%
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <div className="row" style={{ marginTop: "auto", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--navy-line)", gap: 12 }}>
                  <span className="h-3" style={{ fontSize: 24, color: "var(--lime)", fontStyle: "italic" }}>
                    Think you can beat it?
                  </span>
                  <span className="mono hide-sm" style={{ fontSize: 12, color: "var(--navy-ink-2)" }}>
                    preleague.app
                  </span>
                </div>
              </div>
              <Pitch height={380} mini slots={slots} className="hide-sm team-sheet-pitch" colGap={40} rowGap={40} />
            </div>
          </figure>
        </div>
      </section>
    </Shell>
  );
}
