"use client";

import { useState } from "react";
import { createPublicClient, http, type Hex } from "viem";
import { ArrowDownUp, Check, Loader2 } from "lucide-react";
import { WalletButton } from "../WalletButton";
import { useAccount } from "@/lib/wallet-store";
import { sendWithWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { cn } from "@/lib/utils";

type Quote = {
  dex: string;
  pay: string;
  receiveAbout: string;
  receiveAtLeast: string;
  rate: string;
  poolFee: string;
  slippage: string;
  yourBalance: string;
  enoughBalance: boolean;
  simulation: { result?: string; reason?: string; estimatedFeeEth?: string; note?: string };
  steps: (Record<string, unknown> & { summary: string })[];
};

const client = createPublicClient({ transport: http(NETWORKS.robinhood.rpc) });

/** Buy or sell a token for its pair asset (ETH by default) through Uniswap (v3 pools, or v4 pools such as Kindle launches). */
export function SwapBox({
  address,
  symbol,
  pair,
}: {
  address: string;
  symbol: string;
  /** The token's pair asset (ETH when omitted). */
  pair?: { address: string; symbol: string } | null;
}) {
  const isEthPair = !pair || /^0x0{40}$/i.test(pair.address);
  const payId = isEthPair ? "ETH" : pair!.address;
  const paySym = isEthPair ? "ETH" : pair!.symbol;
  const account = useAccount();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"" | "quote" | "swap">("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setQuote(null);
    setError("");
    setProgress([]);
    setDone(null);
  };

  const getQuote = async () => {
    reset();
    if (!account) return setError("Connect your wallet first.");
    if (!(Number(amount) > 0)) return setError("Enter an amount.");
    setBusy("quote");
    try {
      const res = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: account,
          token_in: side === "buy" ? payId : address,
          token_out: side === "buy" ? address : payId,
          amount_in: amount,
          slippage_percent: slippage,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message ?? "Couldn't get a quote.");
      setQuote(d as Quote);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a quote.");
    } finally {
      setBusy("");
    }
  };

  const swap = async () => {
    if (!quote || !account) return;
    setBusy("swap");
    setError("");
    setProgress([]);
    try {
      for (const [i, step] of quote.steps.entries()) {
        setProgress((p) => [...p, `Step ${i + 1}/${quote.steps.length}: ${step.summary} — confirm in your wallet…`]);
        const hash: Hex = await sendWithWallet("robinhood", account, step);
        setProgress((p) => [...p.slice(0, -1), `Step ${i + 1}/${quote.steps.length}: sent, waiting for Robinhood Chain…`]);
        const rc = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (rc.status !== "success") throw new Error(`Step ${i + 1} failed on chain. Nothing else was sent.`);
        setProgress((p) => [...p.slice(0, -1), `Step ${i + 1}/${quote.steps.length}: confirmed ✓`]);
        if (i === quote.steps.length - 1) setDone(hash);
      }
    } catch (e) {
      const rejected = (e as { code?: number }).code === 4001;
      setError(rejected ? "You rejected the transaction in your wallet." : e instanceof Error ? e.message : "The swap failed.");
    } finally {
      setBusy("");
    }
  };

  const simFailed = quote?.simulation?.result?.startsWith("REVERT");

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper p-5">
      <div role="tablist" aria-label="Buy or sell" className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-peach p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={side === s}
            onClick={() => {
              setSide(s);
              reset();
            }}
            className={cn("h-10 rounded-full text-sm font-bold uppercase", side === s ? "bg-ink text-paper" : "opacity-70")}
          >
            {s === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
          </button>
        ))}
      </div>

      <label htmlFor="swap-amount" className="mb-1 block text-xs font-semibold opacity-70">
        You pay ({side === "buy" ? paySym : symbol})
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-ink/15 px-4">
        <input
          id="swap-amount"
          inputMode="decimal"
          placeholder={side === "buy" ? "0.001" : "1000"}
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(",", "."));
            setQuote(null);
          }}
          className="h-14 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none"
        />
        <span className="font-bold">{side === "buy" ? paySym : symbol}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 opacity-70">
          <ArrowDownUp className="size-3.5" /> You receive {side === "buy" ? symbol : paySym}
        </span>
        <label className="flex items-center gap-2">
          <span className="opacity-70">Max slippage</span>
          <select
            value={slippage}
            onChange={(e) => {
              setSlippage(Number(e.target.value));
              setQuote(null);
            }}
            className="rounded-lg border border-ink/15 bg-transparent px-2 py-1"
          >
            {[0.5, 1, 3, 5].map((s) => (
              <option key={s} value={s}>
                {s}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {quote && (
        <dl className="mt-4 space-y-1.5 rounded-2xl bg-peach/60 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">You receive about</dt>
            <dd className="text-right font-bold">{quote.receiveAbout}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">At least</dt>
            <dd className="text-right">{quote.receiveAtLeast}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">Rate</dt>
            <dd className="text-right">{quote.rate}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">Route</dt>
            <dd className="text-right">
              {quote.dex} · fee {quote.poolFee}
            </dd>
          </div>
          {quote.simulation?.estimatedFeeEth && (
            <div className="flex justify-between gap-3">
              <dt className="opacity-70">Gas</dt>
              <dd className="text-right">≈ {Number(quote.simulation.estimatedFeeEth).toPrecision(2)} ETH</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="opacity-70">Your balance</dt>
            <dd className={cn("text-right", !quote.enoughBalance && "font-bold text-[#c62828]")}>{quote.yourBalance}</dd>
          </div>
          {quote.steps.length > 1 && (
            <p className="pt-1 text-xs opacity-70">
              {quote.steps.length} wallet confirmations: exact-amount approval first, then the swap.
            </p>
          )}
          {simFailed && (
            <p role="alert" className="pt-1 text-xs font-semibold text-[#c62828]">
              The dry-run says this swap would fail right now: {quote.simulation.reason}
            </p>
          )}
        </dl>
      )}

      {progress.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {progress.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-[#c62828]">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#0a8f4a]">
          <Check className="size-4" /> Swap confirmed.{" "}
          <a href={`${NETWORKS.robinhood.explorer}/tx/${done}`} target="_blank" rel="noreferrer" className="underline">
            View on explorer
          </a>
        </p>
      )}

      <div className="mt-4">
        {!account ? (
          <WalletButton tone="blue" className="h-12 w-full justify-center" />
        ) : !quote ? (
          <button
            type="button"
            onClick={() => void getQuote()}
            disabled={busy !== ""}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-bold text-[#0b0b0b] disabled:opacity-60"
          >
            {busy === "quote" && <Loader2 className="size-4 animate-spin" />} Get quote
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void swap()}
            disabled={busy !== "" || simFailed || !quote.enoughBalance}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-bold text-paper disabled:opacity-50"
          >
            {busy === "swap" && <Loader2 className="size-4 animate-spin" />}
            {side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs opacity-60">
        You sign every step in your own wallet. Quotes are checked with a dry-run on Robinhood Chain first.
      </p>
    </div>
  );
}
