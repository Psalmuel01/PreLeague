import type { Metadata } from "next";
import { LeaguesView } from "./LeaguesView";

export const metadata: Metadata = { title: "Leagues" };

export default function Page() {
  return <LeaguesView />;
}
