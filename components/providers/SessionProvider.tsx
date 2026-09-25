"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import bs58 from "bs58";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { HistoryJSON, MeJSON } from "@/lib/api-types";

// Wallet sign-in: request a nonce, sign it with the connected wallet, and the
// server sets an httpOnly session cookie. The session is the player identity.

type SessionContext = {
  loaded: boolean;
  /** Signed-in wallet (server session), or null. */
  wallet: string | null;
  displayName: string | null;
  history: HistoryJSON[];
  /** Wallet adapter state. */
  connected: boolean;
  connectedWallet: string | null;
  signingIn: boolean;
  error: string | null;
  /** Connect Phantom (or open Phantom / its download page when it isn't available). */
  connect: () => void;
  /** Ensure a session: opens the wallet picker if needed, then asks for a signature. Resolves true when signed in. */
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
};

const Ctx = createContext<SessionContext | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, signMessage, disconnect, wallets, select } = useWallet();
  const { setVisible } = useWalletModal();
  const [me, setMe] = useState<MeJSON | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSignIn = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      setMe((await res.json()) as MeJSON);
    } catch {
      setMe((m) => m ?? { wallet: null, displayName: null, history: [] });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of the session
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const connectedWallet = publicKey?.toBase58() ?? null;

  // Phantom first: select it (autoConnect then connects). If it isn't installed,
  // phones open this page inside Phantom's browser; desktops get the download page.
  const connect = useCallback(() => {
    const phantom = wallets.find((w) => w.adapter.name === PhantomWalletName);
    const state = phantom?.readyState;
    if (state === WalletReadyState.Installed || state === WalletReadyState.Loadable) {
      select(PhantomWalletName);
      return;
    }
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const url = encodeURIComponent(window.location.href);
      window.location.href = `https://phantom.app/ul/browse/${url}?ref=${encodeURIComponent(window.location.origin)}`;
      return;
    }
    if (wallets.some((w) => w.readyState === WalletReadyState.Installed)) {
      setVisible(true); // another wallet is installed; let the player choose
      return;
    }
    window.open("https://phantom.com/download", "_blank", "noopener,noreferrer");
  }, [wallets, select, setVisible]);

  const doSignIn = useCallback(async (): Promise<boolean> => {
    if (!connectedWallet) return false;
    if (!signMessage) {
      setError("This wallet can’t sign messages. Try Phantom, Solflare or Backpack.");
      return false;
    }
    setSigningIn(true);
    setError(null);
    try {
      const nonceRes = await fetch("/api/auth/nonce", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: connectedWallet }) });
      const { nonce, message, error: nErr } = await nonceRes.json();
      if (!nonceRes.ok) throw new Error(nErr);
      const sig = await signMessage(new TextEncoder().encode(message));
      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: connectedWallet, nonce, signature: bs58.encode(sig) }),
      });
      if (!verify.ok) throw new Error((await verify.json()).error);
      await refresh();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/reject|declin|cancel/i.test(msg) ? "Signature request was declined." : msg || "Sign-in failed");
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [connectedWallet, signMessage, refresh]);

  // If sign-in was requested before a wallet was connected, continue once it connects.
  useEffect(() => {
    if (pendingSignIn.current && connectedWallet) {
      pendingSignIn.current = false;
      void doSignIn();
    }
  }, [connectedWallet, doSignIn]);

  const sessionWallet = me?.wallet ?? null;
  const signIn = useCallback(async () => {
    if (sessionWallet && (!connectedWallet || sessionWallet === connectedWallet)) return true;
    if (!connectedWallet) {
      pendingSignIn.current = true;
      connect();
      return false;
    }
    return doSignIn();
  }, [sessionWallet, connectedWallet, connect, doSignIn]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await disconnect().catch(() => {});
    await refresh();
  }, [disconnect, refresh]);

  const setDisplayName = useCallback(
    async (name: string) => {
      await fetch("/api/me", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<SessionContext>(
    () => ({
      loaded: me !== null,
      wallet: me?.wallet ?? null,
      displayName: me?.displayName ?? null,
      history: me?.history ?? [],
      connected,
      connectedWallet,
      signingIn,
      error,
      connect,
      signIn,
      signOut,
      refresh,
      setDisplayName,
    }),
    [me, connected, connectedWallet, signingIn, error, connect, signIn, signOut, refresh, setDisplayName],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
