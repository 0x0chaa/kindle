"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, defineChain, formatUnits, http, parseUnits, type Address } from "viem";
import { Loader2 } from "lucide-react";
import { useAccount } from "@/lib/wallet-store";
import { ensureChain, getWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { FACTORY, FACTORY_ABI, PROTOCOL_SHARE_BPS, VEST_YEARS } from "@/lib/factory";
import { WalletButton } from "../WalletButton";

const robinhood = defineChain({
  id: NETWORKS.robinhood.chainId,
  name: NETWORKS.robinhood.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.robinhood.rpc] } },
});
const client = createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) });

type Data = { escrow: bigint; buybackBps: number; recipient: string; taxBps: number; locked: bigint; claimable: bigint };

const n = (v: bigint, d: number, max = 6) => Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: max });

/** Creator fees in escrow, buybacks (locked 5 years) and fee sweeps. Payout buttons work for anyone; money goes to the creator. */
export function CreatorPanel({
  address,
  symbol,
  quote,
  graduated,
}: {
  address: string;
  symbol: string;
  quote: { address: string; symbol: string; decimals: number };
  graduated: boolean;
}) {
  const account = useAccount();
  const token = address as Address;
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [amount, setAmount] = useState("");
  const [bps, setBps] = useState("");

  const load = useCallback(async () => {
    if (!FACTORY) return;
    const [l, locked, claimable] = await Promise.all([
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "launchOf", args: [token] }),
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "lockedTokens", args: [token] }),
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "vested", args: [token] }),
    ]);
    setData({ escrow: l.creatorFees, buybackBps: l.buybackBps, recipient: l.feeRecipient, taxBps: l.taxBps, locked, claimable });
  }, [token]);

  useEffect(() => {
    void load().catch(() => {});
    const id = setInterval(() => void load().catch(() => {}), 10_000);
    return () => clearInterval(id);
  }, [load]);

  if (!FACTORY || !data) return null;
  const isRecipient = !!account && account.toLowerCase() === data.recipient.toLowerCase();

  const run = async (label: string, fn: "sweepFees" | "claimCreatorFees" | "claimVested" | "buyback" | "setBuybackBps") => {
    setMsg("");
    const eth = getWallet();
    if (!eth || !account) return setMsg("Connect your wallet first.");
    setBusy(label);
    try {
      await ensureChain(eth, "robinhood");
      const wallet = createWalletClient({ account: account as Address, chain: robinhood, transport: custom(eth as unknown as Parameters<typeof custom>[0]) });
      let hash: `0x${string}`;
      if (fn === "buyback") {
        const { request } = await client.simulateContract({
          account: account as Address,
          address: FACTORY!,
          abi: FACTORY_ABI,
          functionName: "buyback",
          args: [token, parseUnits(amount, quote.decimals)],
        });
        hash = await wallet.writeContract(request);
      } else if (fn === "setBuybackBps") {
        const pct = Math.max(0, Math.min(100, Number(bps)));
        const { request } = await client.simulateContract({
          account: account as Address,
          address: FACTORY!,
          abi: FACTORY_ABI,
          functionName: "setBuybackBps",
          args: [token, Math.round(pct * 100)],
        });
        hash = await wallet.writeContract(request);
      } else {
        const { request } = await client.simulateContract({
          account: account as Address,
          address: FACTORY!,
          abi: FACTORY_ABI,
          functionName: fn,
          args: [token],
        });
        hash = await wallet.writeContract(request);
      }
      const r = await client.waitForTransactionReceipt({ hash });
      setMsg(r.status === "success" ? "Done." : "The transaction failed.");
      setAmount("");
      await load();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "";
      setMsg(/rejected|denied/i.test(m) ? "You rejected the transaction." : m.slice(0, 180));
    }
    setBusy("");
  };

  const btn = "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-50";

  return (
    <div className="mt-4 space-y-4 rounded-3xl border border-ink/10 bg-paper p-5 text-sm">
      <div>
        <h2 className="font-bold">Creator fees</h2>
        <p className="mt-1 opacity-75">
          Every trade pays 1% ({100 - PROTOCOL_SHARE_BPS / 100}% creator, {PROTOCOL_SHARE_BPS / 100}% Kindle)
          {data.taxBps > 0 ? ` plus a ${data.taxBps / 100}% creator tax` : ""}. Fees wait in escrow until claimed; anyone can press the
          buttons, the money always goes to the creator&apos;s wallet.
        </p>
        <p className="mt-2">
          In escrow:{" "}
          <b>
            {n(data.escrow, quote.decimals)} {quote.symbol}
          </b>
          {data.buybackBps > 0 && <span className="opacity-70"> · {data.buybackBps / 100}% goes to buybacks on claim</span>}
        </p>
        {!account ? (
          <WalletButton tone="blue" className="mt-3 h-10" />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {graduated && (
              <button type="button" disabled={!!busy} onClick={() => void run("sweep", "sweepFees")} className={`${btn} border border-ink/20`}>
                {busy === "sweep" && <Loader2 className="size-4 animate-spin" />} Sweep pool fees
              </button>
            )}
            <button
              type="button"
              disabled={!!busy || data.escrow === 0n}
              onClick={() => void run("claim", "claimCreatorFees")}
              className={`${btn} bg-coral text-[#0b0b0b]`}
            >
              {busy === "claim" && <Loader2 className="size-4 animate-spin" />} Claim creator fees
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-ink/10 pt-4">
        <h3 className="font-bold">Buybacks</h3>
        <p className="mt-1 opacity-75">
          The creator can spend escrowed fees to buy {symbol} back. Each buyback is locked and unlocks evenly over {VEST_YEARS} years.
        </p>
        <p className="mt-2">
          Locked: <b>{n(data.locked, 18, 0)}</b> {symbol} · Unlocked now: <b>{n(data.claimable, 18, 0)}</b>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {account && data.claimable > 0n && (
            <button type="button" disabled={!!busy} onClick={() => void run("vest", "claimVested")} className={`${btn} border border-ink/20`}>
              {busy === "vest" && <Loader2 className="size-4 animate-spin" />} Claim unlocked {symbol}
            </button>
          )}
        </div>
        {isRecipient && (
          <div className="mt-3 space-y-2 rounded-2xl bg-ink/5 p-3">
            <div className="flex gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder={`Amount (${quote.symbol})`}
                className="h-10 min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper px-3"
              />
              <button
                type="button"
                disabled={!!busy || !(Number(amount) > 0)}
                onClick={() => void run("buyback", "buyback")}
                className={`${btn} bg-ink text-paper`}
              >
                {busy === "buyback" && <Loader2 className="size-4 animate-spin" />} Buy back now
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={bps}
                onChange={(e) => setBps(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder={`Auto-buyback % on claim (now ${data.buybackBps / 100}%)`}
                className="h-10 min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper px-3"
              />
              <button
                type="button"
                disabled={!!busy || bps === ""}
                onClick={() => void run("bps", "setBuybackBps")}
                className={`${btn} border border-ink/20`}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
      {msg && <p className="break-words">{msg}</p>}
    </div>
  );
}
