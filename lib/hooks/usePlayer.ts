"use client";

import { useSession } from "@/components/providers/SessionProvider";
import { shortAddress } from "@/lib/format";

export type Player = {
  /** Signed in with a wallet (server session). */
  signedIn: boolean;
  /** A wallet is connected in the browser (may not be signed in yet). */
  connected: boolean;
  address: string | null;
  displayName: string;
  initials: string;
  signingIn: boolean;
  error: string | null;
  connect: () => void;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

export function usePlayer(): Player {
  const session = useSession();
  const address = session.wallet ?? session.connectedWallet;
  const displayName = session.displayName || (address ? shortAddress(address) : "You");
  const initials = (session.displayName ? session.displayName.slice(0, 1) : address ? address.slice(0, 2) : "Y").toUpperCase();
  return {
    signedIn: Boolean(session.wallet),
    connected: session.connected,
    address,
    displayName,
    initials,
    signingIn: session.signingIn,
    error: session.error,
    connect: session.connect,
    signIn: session.signIn,
    signOut: session.signOut,
  };
}
