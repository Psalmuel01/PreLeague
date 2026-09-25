import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { ResultsView } from "@/components/views/ResultsView";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ round?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = LEAGUE_BY_SLUG[(await params).slug];
  return { title: league ? `Results · ${league.name}` : "League not found" };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const { round } = await searchParams;
  if (!LEAGUE_BY_SLUG[slug]) notFound();
  return <ResultsView slug={slug} roundId={round || undefined} />;
}
