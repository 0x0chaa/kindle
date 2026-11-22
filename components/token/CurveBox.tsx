"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from "viem";
import { Loader2 } from "lucide-react";
import { WalletButton } from "../WalletButton";
import { useAccount } from "@/lib/wallet-store";
import { ensureChain, getWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { ERC20_ABI, ETH_ADDRESS, FACTORY, FACTORY_ABI } from "@/lib/factory";
import { cn } from "@/lib/utils";

const robinhood = defineChain({
  id: NETWORKS.robinhood.chainId,
  name: NETWORKS.robinhood.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.robinhood.rpc] } },
});
const client = createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) });
const ZERO = "0x0000000000000000000000000000000000000000" as Address;

type State = { graduated: boolean; sold: bigint; raised: bigint; createdAt: bigint; creator: string };
type QuoteAsset = { address: string; symbol: string; decimals: number };

const fmt = (v: bigint, d = 18, max = 6) => {
  const n = Number(formatUnits(v, d));
  return n === 0 ? "0" : n < 1 / 10 ** max ? `<${1 / 10 ** max}` : n.toLocaleString("en-US", { maximumFractionDigits: max });
};

/** Buy or sell on Kindle's bonding curve (before graduation), straight against the factory. */
export function CurveBox({
  address,
  symbol,
  quote,
  graduation,
  taxPct,
  onGraduated,
}: {
  address: string;
  symbol: string;
  quote: QuoteAsset;
  graduation: number;
  taxPct: number;
  onGraduated?: () => void;
}) {
  const isEth = quote.address.toLowerCase() === ETH_ADDRESS;
  const qd = quote.decimals;
  const account = useAccount();
  const token = address as Address;
  const [state, setState] = useState<State | null>(null);
  const [snipeBps, setSnipeBps] = useState(0);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(2);
  const [out, setOut] = useState<{ value: bigint; fee: bigint; tax: bigint; snipe: bigint; refund: bigint } | null>(null);
  const [balance, setBalance] = useState<{ eth: bigint; tok: bigint } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!FACTORY) return;
    const [l, tax] = await Promise.all([
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "launchOf", args: [token] }),
      client.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "snipeTaxBps", args: [token] }),
    ]);
    setState({ graduated: l.graduated, sold: l.sold, raised: l.raised, createdAt: l.createdAt, creator: l.creator });
    setSnipeBps(Number(tax));
    if (l.graduated) onGraduated?.();
    if (account) {
      const [eth, tok] = await Promise.all([
        isEth
          ? client.getBalance({ address: account as Address })
          : client.readContract({ address: quote.address as Address, abi: ERC20_ABI, functionName: "balanceOf", args: [account as Address] }),
        client.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [account as Address] }),
      ]);
      setBalance({ eth, tok });
    }
  }, [token, account, onGraduated, isEth, quote.address]);

  useEffect(() => {
    void refresh().catch(() => {});
    const id = setInterval(() => void refresh().catch(() => {}), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  // live quote
  useEffect(() => {
    setOut(null);
    if (!FACTORY || !(Number(amount) > 0)) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        if (side === "buy") {
          const q = await client.readContract({
            address: FACTORY!,
            abi: FACTORY_ABI,
            functionName: "quoteBuy",
            args: [token, parseUnits(amount, qd), account ? (account as Address) : ZERO],
          });
          if (live) setOut({ value: q.out, fee: q.fee, tax: q.tax, snipe: q.snipe, refund: parseUnits(amount, qd) - q.used });
        } else {
          const [got, fee, tax] = await client.readContract({
            address: FACTORY!,
            abi: FACTORY_ABI,
            functionName: "quoteSell",
            args: [token, parseUnits(amount, 18)],
          });
          if (live) setOut({ value: got, fee, tax, snipe: 0n, refund: 0n });
        }
      } catch {
        if (live) setOut(null);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [amount, side, token, account, state?.sold]);

  const trade = async () => {
    setMsg(null);
    if (!FACTORY || !account || !out) return;
    const eth = getWallet();
    if (!eth) return setMsg({ ok: false, text: "No browser wallet found. Open this page in your wallet app's browser." });
    setBusy(true);
    try {
      await ensureChain(eth, "robinhood");
      const wallet = createWalletClient({ account: account as Address, chain: robinhood, transport: custom(eth as unknown as Parameters<typeof custom>[0]) });
      const min = (out.value * BigInt(Math.round((100 - slippage) * 100))) / 10000n;
      let hash: `0x${string}`;
      if (side === "buy") {
        const amountIn = parseUnits(amount, qd);
        if (!isEth) {
          const allowance = await client.readContract({
            address: quote.address as Address,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [account as Address, FACTORY],
          });
          if (allowance < amountIn) {
            setMsg({ ok: true, text: `Step 1 of 2: approve ${amount} ${quote.symbol} for the curve…` });
            const { request: ap } = await client.simulateContract({
              account: account as Address,
              address: quote.address as Address,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [FACTORY, amountIn],
            });
            await client.waitForTransactionReceipt({ hash: await wallet.writeContract(ap) });
          }
        }
        const { request } = await client.simulateContract({
          account: account as Address,
          address: FACTORY,
          abi: FACTORY_ABI,
          functionName: "buy",
          args: [token, amountIn, min],
          value: isEth ? amountIn : 0n,
        });
        hash = await wallet.writeContract(request);
      } else {
        const { request } = await client.simulateContract({
          account: account as Address,
          address: FACTORY,
          abi: FACTORY_ABI,
          functionName: "sell",
          args: [token, parseUnits(amount, 18), min],
        });
        hash = await wallet.writeContract(request);
      }
      const r = await client.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("The transaction failed on-chain.");
      setMsg({ ok: true, text: side === "buy" ? `Bought ${fmt(out.value, 18, 2)} ${symbol}.` : `Sold for ${fmt(out.value, qd)} ${quote.symbol}.` });
      setAmount("");
      await refresh();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "Failed.";
      setMsg({ ok: false, text: /rejected|denied/i.test(m) ? "You rejected the transaction." : m.slice(0, 200) });
    }
    setBusy(false);
  };

  if (!FACTORY) return null;
  const progress = state ? Number((state.sold * 10000n) / (800_000_000n * 10n ** 18n)) / 100 : 0;
  const raised = state ? Number(formatUnits(state.raised, qd)) : 0;
  const isCreator = !!account && !!state && account.toLowerCase() === state.creator.toLowerCase();

  return (
    <div className="rounded-3xl border border-ink/10 bg-paper p-5">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-bold">Bonding curve</span>
        <span className="font-mono">{progress.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-coral" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <p className="mt-2 text-xs opacity-70">
        {raised.toLocaleString("en-US", { maximumFractionDigits: 4 })} / {graduation.toLocaleString("en-US")} {quote.symbol} raised. When the
        curve sells out, {symbol} graduates to a locked Uniswap v4 pool.{taxPct > 0 ? ` Creator tax: ${taxPct}% per trade.` : ""}
      </p>
      {snipeBps > 0 && !isCreator && (
        <p className="mt-3 rounded-xl bg-[#c62828]/10 px-3 py-2 text-xs font-semibold text-[#c62828]">
          Anti-snipe tax right now: {(snipeBps / 100).toFixed(0)}% — it drops to 0 a few seconds after launch.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setAmount("");
              setMsg(null);
            }}
            className={cn("h-10 rounded-full text-sm font-bold uppercase", side === s ? "bg-ink text-paper" : "opacity-70")}
          >
            {s} {symbol}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-xs font-semibold opacity-70">
        {side === "buy" ? `You pay (${quote.symbol})` : `You sell (${symbol})`}
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          className="mt-1 h-12 w-full rounded-2xl border border-ink/15 bg-paper px-4 text-lg font-bold outline-none focus:border-coral"
        />
      </label>
      {balance && (
        <button
          type="button"
          onClick={() => setAmount(side === "buy" ? "" : formatUnits(balance.tok, 18))}
          className="mt-1 text-xs opacity-60 hover:opacity-100"
        >
          Balance: {side === "buy" ? `${fmt(balance.eth, qd)} ${quote.symbol}` : `${fmt(balance.tok, 18, 2)} ${symbol} (use max)`}
        </button>
      )}

      {out && (
        <div className="mt-3 space-y-1 rounded-2xl bg-ink/5 p-3 text-xs">
          <div className="flex justify-between">
            <span className="opacity-70">You receive about</span>
            <b>{side === "buy" ? `${fmt(out.value, 18, 2)} ${symbol}` : `${fmt(out.value, qd)} ${quote.symbol}`}</b>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Fee (1%)</span>
            <span>
              {fmt(out.fee, qd)} {quote.symbol}
            </span>
          </div>
          {out.tax > 0n && (
            <div className="flex justify-between">
              <span className="opacity-70">Creator tax ({taxPct}%)</span>
              <span>
                {fmt(out.tax, qd)} {quote.symbol}
              </span>
            </div>
          )}
          {out.snipe > 0n && (
            <div className="flex justify-between text-[#c62828]">
              <span>Anti-snipe tax</span>
              <span>
                {fmt(out.snipe, qd)} {quote.symbol}
              </span>
            </div>
          )}
          {out.refund > 0n && (
            <div className="flex justify-between">
              <span className="opacity-70">Not used (curve sells out)</span>
              <span>
                {fmt(out.refund, qd)} {quote.symbol}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="opacity-70">Max slippage</span>
            <span className="flex gap-1">
              {[1, 2, 5].map((s) => (
                <button key={s} type="button" onClick={() => setSlippage(s)} className={cn("rounded px-1.5", slippage === s && "bg-coral text-[#0b0b0b]")}>
                  {s}%
                </button>
              ))}
            </span>
          </div>
        </div>
      )}

      {msg && <p className={cn("mt-3 text-sm font-semibold", msg.ok ? "text-[#0a8f4a]" : "text-[#c62828]")}>{msg.text}</p>}

      {!account ? (
        <WalletButton tone="blue" className="mt-4 h-12 w-full justify-center" />
      ) : (
        <button
          type="button"
          onClick={() => void trade()}
          disabled={busy || !out || out.value === 0n || state?.graduated}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-bold text-[#0b0b0b] disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy ? "Confirm in your wallet…" : side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
        </button>
      )}
    </div>
  );
}
