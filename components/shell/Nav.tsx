"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_LEAGUE } from "@/lib/leagues";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useGame } from "@/components/providers/GameProvider";
import { Avatar } from "@/components/ui/bits";
import { Icon, LogoMark, type IconName } from "@/components/ui/Icon";
import { shortAddress } from "@/lib/format";

const LIVE_HREF = `/league/${DEFAULT_LEAGUE.slug}/live`;

const LINKS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { href: "/leagues", label: "Leagues", icon: "trophy", match: (p) => p.startsWith("/leagues") || (p.startsWith("/league/") && !p.endsWith("/live") && !p.endsWith("/results")) },
  { href: LIVE_HREF, label: "Leaderboard", icon: "chart", match: (p) => p.endsWith("/live") || p.endsWith("/results") },
  { href: "/how-it-works", label: "How it works", icon: "info", match: (p) => p.startsWith("/how-it-works") },
];

export function DesktopNav() {
  const pathname = usePathname();
  return (
    <header className="d-nav">
      <div className="d-nav-inner">
        <Link className="wordmark" href="/" aria-label="PreLeague home">
          <LogoMark />
          <span>
            <i>Pre</i>League
          </span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {LINKS.map((l) => {
            const on = l.match(pathname);
            return (
              <Link key={l.href} className={["nav-link", on ? "on" : ""].join(" ")} href={l.href} aria-current={on ? "page" : undefined}>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="nav-right">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

export function MobileBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mbar">
      {children ?? (
        <>
          <Link className="wordmark" href="/" aria-label="PreLeague home">
            <LogoMark size={26} />
            <span>
              <i>Pre</i>League
            </span>
          </Link>
          <span className="spacer" />
          <WalletButton compact />
        </>
      )}
    </header>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const tabs = [...LINKS.slice(0, 3), { href: "/profile", label: "Profile", icon: "user" as IconName, match: (p: string) => p.startsWith("/profile") }];
  return (
    <nav className="tabbar" aria-label="Primary">
      {tabs.map((t) => {
        const on = t.match(pathname);
        return (
          <Link key={t.href} className={["tab", on ? "on" : ""].join(" ")} href={t.href} aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function WalletButton({ compact }: { compact?: boolean }) {
  const player = usePlayer();
  const { ready } = useGame();
  if (!ready) return <span className="wallet-btn disconnected" style={{ visibility: "hidden" }}>Connect wallet</span>;
  if (!player.connected) {
    return (
      <button className={compact ? "btn btn-lime btn-sm" : "wallet-btn disconnected"} style={compact ? { height: 44 } : undefined} type="button" onClick={player.connect}>
        Connect wallet
      </button>
    );
  }
  return (
    <Link className="wallet-btn" href="/profile" aria-label={`Wallet ${shortAddress(player.address!)}, open profile`}>
      {!compact && <span className="addr">{shortAddress(player.address!)}</span>}
      <Avatar initials={player.initials} tone="av-you" size="sm" />
    </Link>
  );
}

export function Footer() {
  return (
    <footer className="band">
      <div className="container foot-inner" style={{ position: "relative" }}>
        <span className="wordmark" style={{ fontSize: 24 }}>
          <span>
            <i>Pre</i>League
          </span>
        </span>
        <p className="caption" style={{ maxWidth: 560, fontSize: 13 }}>
          League squads are virtual — you never buy the companies you draft. Prizes are paid in real PreStocks to your connected wallet. Prices from the PreStocks API.
        </p>
        <span className="spacer" />
        <nav style={{ display: "flex", gap: 24, fontSize: 14 }} aria-label="Footer">
          <Link href="/how-it-works" style={{ color: "#fff" }}>
            How it works
          </Link>
          <Link href="/how-it-works#rules" style={{ color: "#fff" }}>
            Rules
          </Link>
          <a href="https://prestocks.com" style={{ color: "#fff" }} target="_blank" rel="noreferrer">
            PreStocks
          </a>
        </nav>
      </div>
    </footer>
  );
}
