import Link from "next/link";

export default function NotFound() {
  return (
    <main className="band" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div className="container stack" style={{ gap: 18, position: "relative" }}>
        <span className="eyebrow" style={{ color: "var(--lime)" }}>
          404 · Off the pitch
        </span>
        <h1 className="h-hero t-hero-sm">
          Page <span className="hl">not found</span>
        </h1>
        <p className="lead" style={{ color: "var(--navy-ink-2)" }}>
          That league or page doesn’t exist.
        </p>
        <Link className="btn btn-lime btn-lg" href="/" style={{ alignSelf: "flex-start" }}>
          Back to PreLeague
        </Link>
      </div>
    </main>
  );
}
