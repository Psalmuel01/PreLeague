import type { Metadata, Viewport } from "next";
import { Big_Shoulders, JetBrains_Mono, Outfit } from "next/font/google";
import { GameProvider } from "@/components/providers/GameProvider";
import { PriceProvider } from "@/components/providers/PriceProvider";
import { WalletProviders } from "@/components/providers/WalletProviders";
import "./pl.css";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-display", subsets: ["latin"], weight: ["700", "800", "900"], adjustFontFallback: false });
const ui = Outfit({ variable: "--font-ui", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: { default: "PreLeague — Draft tomorrow’s winners", template: "%s · PreLeague" },
  description:
    "Fantasy sports for private companies. Draft three PreStocks, compete on real market performance, and win actual PreStocks on Solana.",
};

export const viewport: Viewport = {
  themeColor: "#0A1440",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>
        <WalletProviders>
          <GameProvider>
            <PriceProvider>{children}</PriceProvider>
          </GameProvider>
        </WalletProviders>
      </body>
    </html>
  );
}
