"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { connect, disconnect, short, useAccount } from "@/lib/wallet-store";
import { cn } from "@/lib/utils";

/** Connect / disconnect button used in the nav, the menu and the swap and launch forms. */
export function WalletButton({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" | "blue" }) {
  const account = useAccount();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const styles = {
    light: "border border-current/40 hover:bg-white hover:text-black",
    dark: "bg-ink text-paper hover:bg-coral hover:text-ink",
    blue: "bg-coral text-ink hover:bg-ink hover:text-paper",
  }[tone];

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        title={account ? "Disconnect" : undefined}
        onClick={async () => {
          setError("");
          if (account) return disconnect();
          setBusy(true);
          try {
            await connect();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't connect.");
          } finally {
            setBusy(false);
          }
        }}
        className={cn("inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors", styles, className)}
      >
        <Wallet className="size-4" />
        {account ? short(account) : busy ? "Connecting…" : "Connect wallet"}
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-xs text-xs text-[#3d7a00]">
          {error}
        </span>
      )}
    </div>
  );
}
