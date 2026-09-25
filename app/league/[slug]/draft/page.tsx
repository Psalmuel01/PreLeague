import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEAGUE_BY_SLUG } from "@/lib/leagues";
import { DraftView } from "@/components/views/DraftView";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const league = LEAGUE_BY_SLUG[(await params).slug];
  return { title: league ? `Draft · ${league.name}` : "League not found" };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  if (!LEAGUE_BY_SLUG[slug]) notFound();
  return <DraftView slug={slug} />;
}
