"use client";

import { useSyncExternalStore } from "react";
import { connectWallet, getInjected, setActiveProvider, type Eip1193 } from "./wallet";

// One shared connected-wallet state for the whole site (nav, swap box, launch form).
// The account comes either from a browser wallet or from an X / email sign-in (Privy wallet).
type Source = "browser" | "social" | null;
type Social = { login: (method: "twitter" | "email") => void; logout: () => Promise<void> | void };

let account: string | null = null;
let source: Source = null;
let social: Social | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let watching = false;

function watch() {
  if (watching || typeof window === "undefined") return;
  const eth = getInjected();
  if (!eth) return;
  watching = true;
  eth.on?.("accountsChanged", (...a: unknown[]) => {
    if (source === "social") return;
    const list = a[0] as string[] | undefined;
    account = list?.[0] ?? null;
    source = account ? "browser" : null;
    emit();
  });
  // Restore a previous connection silently (no popup).
  eth
    .request({ method: "eth_accounts" })
    .then((r) => {
      const list = r as string[];
      if (list?.[0] && !account) {
        account = list[0];
        source = "browser";
        emit();
      }
    })
    .catch(() => {});
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  watch();
  return () => listeners.delete(cb);
};

export function useAccount() {
  return useSyncExternalStore(subscribe, () => account, () => null);
}

/** "browser" | "social" | null — how the current account signed in. */
export function useSource() {
  return useSyncExternalStore(subscribe, () => source, () => null);
}

/** True when X / email sign-in is configured (Privy app ID set). */
export function useSocialAvailable() {
  return useSyncExternalStore(subscribe, () => social !== null, () => false);
}

export async function connect(): Promise<string> {
  const a = await connectWallet();
  setActiveProvider(null);
  account = a;
  source = "browser";
  watch();
  emit();
  return a;
}

export function loginSocial(method: "twitter" | "email") {
  social?.login(method);
}

export function disconnect() {
  if (source === "social") void social?.logout();
  setActiveProvider(null);
  account = null;
  source = null;
  emit();
}

/* Called by AuthProvider */
export function registerSocial(s: Social | null) {
  social = s;
  emit();
}

export function setSocialAccount(address: string, provider: Eip1193) {
  setActiveProvider(provider);
  account = address;
  source = "social";
  emit();
}

export function clearSocialAccount() {
  if (source !== "social") return;
  setActiveProvider(null);
  account = null;
  source = null;
  emit();
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
