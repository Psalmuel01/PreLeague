"use client";

import { useCallback } from "react";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useGame } from "@/components/providers/GameProvider";
import { shortAddress } from "@/lib/format";

export type Player = {
  connected: boolean;
  address: string | null;
  /** Guest play is allowed in demo mode only. */
  canPlay: boolean;
  displayName: string;
  initials: string;
  connect: () => void;
  disconnect: () => Promise<void>;
  /** Sign a UTF-8 message; resolves to a base58 signature, or null when the wallet can't sign. */
  sign: (message: string) => Promise<string | null>;
};

export function usePlayer(): Player {
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { name, settings } = useGame();

  const address = publicKey?.toBase58() ?? null;
  const displayName = name || (address ? shortAddress(address) : settings.demo ? "Guest" : "You");
  const initials = (name ? name.slice(0, 1) : address ? address.slice(0, 2) : "G").toUpperCase();

  const sign = useCallback(
    async (message: string) => {
      if (!signMessage) return null;
      const sig = await signMessage(new TextEncoder().encode(message));
      return bs58.encode(sig);
    },
    [signMessage],
  );

  return {
    connected,
    address,
    canPlay: connected || settings.demo,
    displayName,
    initials,
    connect: () => setVisible(true),
    disconnect,
    sign,
  };
}
