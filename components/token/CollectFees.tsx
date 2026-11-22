"use client";

import { useState } from "react";
import { createPublicClient, http } from "viem";
import { Loader2 } from "lucide-react";
import { useAccount } from "@/lib/wallet-store";
import { sendWithWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { FACTORY, PROTOCOL_SHARE_BPS } from "@/lib/factory";
import { WalletButton } from "../WalletButton";

/** Pays a Kindle token's accrued swap fees to its creator and the treasury. Anyone can press it. */
export function CollectFees({ address }: { address: string }) {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!FACTORY) return null;

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const hash = await sendWithWallet("robinhood", account!, { to: FACTORY, signature: "collectFees(address)", args: [address] });
      const r = await createPublicClient({ transport: http(NETWORKS.robinhood.rpc) }).waitForTransactionReceipt({ hash });
      setMsg(r.status === "success" ? "Fees sent to the creator and the treasury." : "The transaction failed.");
    } catch (e) {
      const m = (e as Error).message ?? "";
      setMsg(/rejected|denied/i.test(m) ? "You rejected the transaction." : m.slice(0, 160));
    }
    setBusy(false);
  };

  return (
    <div className="mt-4 rounded-3xl border border-ink/10 bg-paper p-5 text-sm">
      <h2 className="font-bold">Creator fees</h2>
      <p className="mt-1 opacity-75">
        Each swap pays a 1% pool fee: {100 - PROTOCOL_SHARE_BPS / 100}% to the creator, {PROTOCOL_SHARE_BPS / 100}% to Kindle. Collecting
        sends what has built up — anyone can trigger it, the money always goes to the creator&apos;s wallet.
      </p>
      {account ? (
        <button type="button" onClick={() => void run()} disabled={busy} className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-coral px-5 font-bold text-ink disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Collect fees
        </button>
      ) : (
        <WalletButton tone="blue" className="mt-3 h-11" />
      )}
      {msg && <p className="mt-2 break-words">{msg}</p>}
    </div>
  );
}
