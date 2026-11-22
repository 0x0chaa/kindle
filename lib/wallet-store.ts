"use client";

import { useSyncExternalStore } from "react";
import { connectWallet, getWallet } from "./wallet";

// One shared connected-wallet state for the whole site (nav, swap box, launch form, agent console).
let account: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let watching = false;

function watch() {
  if (watching || typeof window === "undefined") return;
  const eth = getWallet();
  if (!eth) return;
  watching = true;
  eth.on?.("accountsChanged", (...a: unknown[]) => {
    const list = a[0] as string[] | undefined;
    account = list?.[0] ?? null;
    emit();
  });
  // Restore a previous connection silently (no popup).
  eth
    .request({ method: "eth_accounts" })
    .then((r) => {
      const list = r as string[];
      if (list?.[0]) {
        account = list[0];
        emit();
      }
    })
    .catch(() => {});
}

export function useAccount() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      watch();
      return () => listeners.delete(cb);
    },
    () => account,
    () => null,
  );
}

export async function connect(): Promise<string> {
  const a = await connectWallet();
  account = a;
  watch();
  emit();
  return a;
}

export function disconnect() {
  account = null;
  emit();
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
