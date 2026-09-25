import type { Metadata } from "next";
import { HowItWorksView } from "./HowItWorksView";

export const metadata: Metadata = { title: "How it works" };

export default function Page() {
  return <HowItWorksView />;
}
