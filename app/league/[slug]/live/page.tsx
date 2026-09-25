import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { LiveView } from "@/components/views/LiveView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = LEAGUE_BY_SLUG[(await params).slug];
  return { title: league ? `Live · ${league.name}` : "League not found" };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!LEAGUE_BY_SLUG[slug]) notFound();
  return <LiveView slug={slug} />;
}
