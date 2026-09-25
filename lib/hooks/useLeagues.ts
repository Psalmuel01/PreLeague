"use client";

import { useEffect, useState } from "react";
import type { SeriesJSON } from "@/lib/api-types";
import { useSession } from "@/components/providers/SessionProvider";

/** Every league series with its live, next and last round summaries. */
export function useLeagues() {
  const { wallet } = useSession();
  const [data, setData] = useState<SeriesJSON[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/leagues", { cache: "no-store" })
        .then((r) => r.json())
        .then((d: SeriesJSON[]) => !cancelled && setData(d))
        .catch(() => {});
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [wallet]);
  return data;
}
