"use client";

import { DesktopNav, Footer, MobileBar, TabBar } from "./Nav";

export function Shell({
  children,
  mobileBar,
  tabs = true,
  footer = true,
}: {
  children: React.ReactNode;
  /** Replaces the default mobile top bar content. */
  mobileBar?: React.ReactNode;
  tabs?: boolean;
  footer?: boolean;
}) {
  return (
    <div className={["site", tabs ? "" : "no-tabs"].join(" ")}>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <DesktopNav />
      <MobileBar>{mobileBar}</MobileBar>
      <main id="main">{children}</main>
      {footer && <Footer />}
      <TabBar />
    </div>
  );
}

/** Placeholder band shown until client state (clock, storage) is ready. */
export function PageSkeleton({ height = 360 }: { height?: number }) {
  return (
    <section className="band" style={{ height }} aria-busy="true">
      <div className="container" style={{ paddingTop: 48, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="skel" style={{ width: 180, height: 16, opacity: 0.2 }} />
        <div className="skel" style={{ width: "min(520px, 80%)", height: 64, opacity: 0.2 }} />
      </div>
    </section>
  );
}
