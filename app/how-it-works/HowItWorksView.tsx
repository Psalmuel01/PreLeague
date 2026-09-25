"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/shell/Shell";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Pitch } from "@/components/ui/Pitch";

const STEPS: { n: number; title: string; body: string; icon: IconName; lime?: boolean }[] = [
  { n: 1, title: "Draft", body: "Choose three private companies.", icon: "plus" },
  { n: 2, title: "Compete", body: "Your squad moves with real PreStock market prices.", icon: "chart" },
  { n: 3, title: "Win", body: "Top performers can receive real PreStocks on Solana.", icon: "trophy", lime: true },
];

const RULES: [string, string][] = [
  ["Squads", "Pick exactly three companies from the league’s draft pool. Every pick has equal weight (33.3%). Anyone can draft any company — picks aren’t exclusive."],
  ["Lock", "You sign a message with your wallet to lock your lineup. No transaction, no fee. Lineups can’t change once the round kicks off."],
  ["Price source", "Scores use the PreStocks API token price. Kick-off and final-whistle prices are the average of the first and last snapshots of the round, sampled every minute, so one odd quote can’t decide a round."],
  ["Scoring", "Each company’s return is (end − start) ÷ start. Your squad’s score is the plain average of your three returns."],
  ["Tie-breaks", "Equal scores are split by your best single pick, then your second-best pick, then whoever locked their lineup first."],
  ["Missing prices", "If any company has no fresh price near kick-off or the final whistle, the round is reviewed or voided. We never score on stale or invented prices."],
  ["Corporate actions", "If a PreStock converts, lists, pauses or changes its token mechanics mid-round, the affected round is voided and prizes are re-run."],
  ["Prizes", "The winner receives the league’s prize in real PreStocks, sent to the wallet they played with. Squads themselves are virtual — you never buy what you draft."],
];

const FAQS = [
  { q: "Do I have to buy the companies I draft?", a: "No. Your league squad is virtual — it simply tracks how your three picks perform. Nothing is bought or sold." },
  { q: "What is a PreStock?", a: "A PreStock is a Solana token that tracks the price of a private company’s shares, backed 1:1 by SPV exposure. It lets you follow — and own a slice of — companies before they go public." },
  { q: "How do I get my prize?", a: "Claim it from the results screen after the final whistle. It’s sent straight to the wallet you connected." },
  { q: "Why is the round only 15 minutes?", a: "Sprint rounds are built for quick, live competition. Daily and weekly leagues run on the same rules over longer windows." },
];

export function HowItWorksView() {
  const [open, setOpen] = useState<number>(-1);
  return (
    <Shell>
      <section className="band" style={{ padding: "72px 0 136px" }}>
        <span className="band-slash" style={{ right: -60, width: 220 }} aria-hidden="true" />
        <span className="band-slash thin" style={{ right: 200, opacity: 0.9 }} aria-hidden="true" />
        <div className="container stack" style={{ position: "relative", gap: 20 }}>
          <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 16 }}>
            How it works
          </span>
          <h1 className="h-hero t-hero-sm">
            How <span className="hl">PreLeague</span> works
          </h1>
          <p className="lead" style={{ maxWidth: 560, color: "var(--navy-ink-2)" }}>
            Fantasy sports for private companies. Three picks, one round, real prizes.
          </p>
        </div>
      </section>

      <section style={{ position: "relative", marginTop: -88, zIndex: 2 }}>
        <div className="container">
          <ol className="cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card stack" style={{ overflow: "hidden" }}>
                <div className="card-head" style={{ justifyContent: "space-between", ...(s.lime ? { background: "var(--lime)", color: "var(--navy)" } : {}) }}>
                  <span>Step {s.n}</span>
                  <Icon name={s.icon} style={s.lime ? undefined : { color: "var(--lime)" }} />
                </div>
                <div className="stack hiw-step">
                  <span className="score hiw-num">{s.n}</span>
                  <h2 className="h-1 t-section">{s.title}</h2>
                  <p className="lead" style={{ maxWidth: 320 }}>
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section style={{ padding: "96px 0 0" }}>
        <div className="container split" style={{ "--side": "560px", "--gap": "56px", "--align": "center" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 22 }}>
            <span className="eyebrow">Scoring</span>
            <h2 className="h-1 t-section">
              How scoring <span className="hl">works</span>
            </h2>
            <p className="lead" style={{ maxWidth: 520 }}>
              Each pick has equal weight. The percentage change of each company is averaged to produce your squad’s return.
            </p>
            <div className="card-night row wrap" style={{ padding: "22px 24px", gap: 20, borderRadius: 16 }} aria-label="Scoring example">
              <div className="stack" style={{ gap: 8, flexGrow: 1 }}>
                <span className="eyebrow">Example</span>
                <p className="fig-m num">
                  (<span style={{ color: "var(--lime)" }}>+6.0</span> + <span style={{ color: "var(--lime)" }}>3.0</span> <span style={{ color: "#FF8A80" }}>− 3.0</span>) ÷ 3
                </p>
              </div>
              <span className="fig-m" style={{ color: "var(--navy-ink-2)" }}>
                =
              </span>
              <div className="stat-box hero" style={{ padding: "14px 18px", minWidth: 170 }}>
                <span className="k">Squad return</span>
                <span className="v" style={{ fontSize: 44 }}>
                  +2.00%
                </span>
              </div>
            </div>
          </div>
          <Pitch
            height={420}
            slots={[
              { id: "openai", value: 0.06 },
              { id: "figureai", value: 0.03 },
              { id: "neuralink", value: -0.03 },
            ]}
            tag={<span className="badge">Example squad</span>}
            padTop={36}
            rowGap={30}
            colGap={120}
            label="Example squad: OpenAI +6.0%, Figure AI +3.0%, Neuralink −3.0%"
          />
        </div>
      </section>

      <section style={{ padding: "96px 0 0" }} id="rules">
        <div className="container split-left" style={{ "--side": "360px", "--gap": "64px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 12 }}>
            <h2 className="h-1 t-section">Rules</h2>
            <p className="body">The full rulebook. Short, deterministic, and the same for every league.</p>
          </div>
          <dl className="card" style={{ margin: 0, overflow: "hidden" }}>
            {RULES.map(([k, v], i) => (
              <div key={k} className="rule-def" style={{ borderTop: i ? "1px solid var(--line)" : 0 }}>
                <dt className="eyebrow" style={{ color: "var(--ink)" }}>
                  {k}
                </dt>
                <dd className="body" style={{ margin: 0 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section style={{ padding: "96px 0" }}>
        <div className="container split-left" style={{ "--side": "360px", "--gap": "64px" } as React.CSSProperties}>
          <div className="stack" style={{ gap: 12 }}>
            <h2 className="h-1 t-section">Questions</h2>
            <p className="body">The short answers before your first round.</p>
          </div>
          <div className="stack" style={{ gap: 12 }}>
            {FAQS.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className="disclosure" style={isOpen ? { borderColor: "var(--navy)" } : undefined}>
                  <button className="disclosure-head" type="button" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? -1 : i)} style={{ minHeight: 64, fontSize: 16.5 }}>
                    <span className="slot-no">{i + 1}</span>
                    <span style={{ flexGrow: 1 }}>{f.q}</span>
                    <Icon name="chevronDown" style={{ transform: isOpen ? "rotate(180deg)" : undefined, transition: "transform .15s", color: isOpen ? "var(--navy)" : "var(--ink-3)" }} />
                  </button>
                  {isOpen && (
                    <p id={`faq-${i}`} className="body" style={{ padding: "0 18px 20px 56px", maxWidth: 700 }}>
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="band">
        <span className="band-slash hide-sm" style={{ right: -60, width: 220 }} aria-hidden="true" />
        <div className="container row wrap hiw-cta">
          <div className="stack" style={{ gap: 10 }}>
            <h2 className="h-1 t-section">
              Ready for the <span className="hl">next round?</span>
            </h2>
            <p className="lead" style={{ color: "var(--navy-ink-2)" }}>
              Free to join. Pick three and you’re in.
            </p>
          </div>
          <span className="spacer" />
          <Link className="btn btn-lime btn-lg" href="/leagues">
            Join a league
          </Link>
        </div>
      </section>
    </Shell>
  );
}
