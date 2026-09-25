import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PreLeague",
    short_name: "PreLeague",
    description: "Fantasy sports for private companies. Draft three PreStocks and win a PreStock prize on Solana.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1440",
    theme_color: "#0A1440",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
