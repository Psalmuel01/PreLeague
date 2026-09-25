// The PreStocks draft pool. Colours and monograms come from the Matchday design
// system; mints and symbols match https://prestocks.com/api/prestocks.

export type CompanyId =
  | "openai"
  | "anthropic"
  | "spacex"
  | "neuralink"
  | "anduril"
  | "figureai"
  | "kalshi"
  | "polymarket";

export type Company = {
  id: CompanyId;
  symbol: string;
  name: string;
  mono: string;
  /** Official logo (from the PreStocks API), served from /public/logos */
  logo: string;
  /** Logo tile background (matches the logo's own background) */
  fill: string;
  /** Logo tile text colour */
  ink: string;
  /** Short draft-card tagline */
  desc: string;
  /** One-line "About" copy for the company sheet */
  about: string;
  mint: string;
};

export const COMPANIES: Company[] = [
  {
    id: "openai",
    symbol: "OPENAI",
    name: "OpenAI",
    mono: "OA",
    logo: "/logos/openai.png",
    fill: "#0EA982",
    ink: "#fff",
    desc: "AI research",
    about: "AI research lab behind ChatGPT.",
    mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
  },
  {
    id: "anthropic",
    symbol: "ANTHROPIC",
    name: "Anthropic",
    mono: "An",
    logo: "/logos/anthropic.png",
    fill: "#D3A27F",
    ink: "#fff",
    desc: "AI safety & models",
    about: "AI safety company building Claude.",
    mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
  },
  {
    id: "spacex",
    symbol: "SPACEX",
    name: "SpaceX",
    mono: "SX",
    logo: "/logos/spacex.png",
    fill: "#FFFFFF",
    ink: "#fff",
    desc: "Launch & satellites",
    about: "Reusable rockets and Starlink satellite internet.",
    mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
  },
  {
    id: "neuralink",
    symbol: "NEURALINK",
    name: "Neuralink",
    mono: "NL",
    logo: "/logos/neuralink.png",
    fill: "#F4F4F4",
    ink: "#0B1A2A",
    desc: "Brain–computer interfaces",
    about: "Implantable brain–computer interfaces.",
    mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S",
  },
  {
    id: "anduril",
    symbol: "ANDURIL",
    name: "Anduril",
    mono: "AD",
    logo: "/logos/anduril.png",
    fill: "#FFFFFF",
    ink: "#EAF0E6",
    desc: "Defense tech",
    about: "Autonomous defense systems and sensors.",
    mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
  },
  {
    id: "figureai",
    symbol: "FIGUREAI",
    name: "Figure AI",
    mono: "FG",
    logo: "/logos/figureai.png",
    fill: "#000000",
    ink: "#3A1C00",
    desc: "Humanoid robots",
    about: "General-purpose humanoid robots.",
    mint: "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd",
  },
  {
    id: "kalshi",
    symbol: "KALSHI",
    name: "Kalshi",
    mono: "KA",
    logo: "/logos/kalshi.png",
    fill: "#FFFFFF",
    ink: "#fff",
    desc: "Event markets",
    about: "CFTC-regulated market for event contracts.",
    mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
  },
  {
    id: "polymarket",
    symbol: "POLYMARKET",
    name: "Polymarket",
    mono: "PM",
    logo: "/logos/polymarket.png",
    fill: "#2F5CFF",
    ink: "#fff",
    desc: "Prediction markets",
    about: "Crypto-native prediction market.",
    mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
  },
];

export const COMPANY_BY_ID = Object.fromEntries(COMPANIES.map((c) => [c.id, c])) as Record<
  CompanyId,
  Company
>;

export const COMPANY_BY_SYMBOL = Object.fromEntries(COMPANIES.map((c) => [c.symbol, c])) as Record<
  string,
  Company
>;

export const ALL_COMPANY_IDS = COMPANIES.map((c) => c.id);
