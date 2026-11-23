"use client";

import { useEffect, type ReactNode } from "react";
import { PrivyProvider, usePrivy, useWallets } from "@privy-io/react-auth";
import { defineChain } from "viem";
import { NETWORKS } from "@/lib/networks";
import { clearSocialAccount, registerSocial, setSocialAccount } from "@/lib/wallet-store";
import type { Eip1193 } from "@/lib/wallet";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

const net = NETWORKS.robinhood;
const robinhood = defineChain({
  id: net.chainId,
  name: net.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [net.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: net.explorer } },
});

/**
 * Sign in with X or email through Privy. Privy creates a self-custodial wallet for the user;
 * every transaction still opens a confirmation the user has to approve. Kindle never sees the key.
 * Without NEXT_PUBLIC_PRIVY_APP_ID the site falls back to browser wallets only.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={APP_ID}
      {...(CLIENT_ID ? { clientId: CLIENT_ID } : {})}
      config={{
        loginMethods: ["twitter", "email"],
        appearance: { theme: "dark", accentColor: "#ccff00", walletChainType: "ethereum-only" },
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: true },
        defaultChain: robinhood,
        supportedChains: [robinhood],
      }}
    >
      <Bridge />
      {children}
    </PrivyProvider>
  );
}

/** Hands the Privy wallet to Kindle's wallet store, so every form signs with it. */
function Bridge() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    registerSocial({
      login: (method) => login({ loginMethods: [method] } as never),
      logout,
    });
    return () => registerSocial(null);
  }, [login, logout]);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      clearSocialAccount();
      return;
    }
    const w = wallets.find((x) => x.walletClientType === "privy");
    if (!w) return;
    let off = false;
    (async () => {
      await w.switchChain(net.chainId).catch(() => {});
      const provider = (await w.getEthereumProvider()) as unknown as Eip1193;
      if (!off) setSocialAccount(w.address, provider);
    })();
    return () => {
      off = true;
    };
  }, [ready, authenticated, wallets]);

  return null;
}
