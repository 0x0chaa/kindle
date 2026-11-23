"use client";

import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, defineChain, formatEther, formatUnits, http, parseEventLogs, parseUnits, type Address } from "viem";
import { Check, ImagePlus, Loader2, Rocket } from "lucide-react";
import { useApp } from "../Providers";
import { WalletButton } from "../WalletButton";
import { useAccount } from "@/lib/wallet-store";
import { ensureChain, getWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { CURVE_RAW, ERC20_ABI, ETH_ADDRESS, FACTORY, FACTORY_ABI, MAX_TAX_PCT, PROTOCOL_SHARE_BPS, POOL_FEE_PCT, SNIPE_WINDOW_S, VEST_YEARS, VIRTUAL_TOKENS_RAW, virtualQuote } from "@/lib/factory";

const robinhood = defineChain({
  id: NETWORKS.robinhood.chainId,
  name: NETWORKS.robinhood.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.robinhood.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: NETWORKS.robinhood.explorer } },
});

const errText = (e: unknown) =>
  typeof e === "string" ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? "The launch failed.";

type PairOpt = { address: string; symbol: string; decimals: number; graduation: bigint };
const DEFAULT_PAIR: PairOpt = { address: ETH_ADDRESS, symbol: "ETH", decimals: 18, graduation: 42n * 10n ** 17n };

/** Enabled pair assets from the factory (ETH first). */
async function loadPairs(): Promise<PairOpt[]> {
  if (!FACTORY) return [DEFAULT_PAIR];
  const c = createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) });
  const list = await c.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "pairList" });
  const out = await Promise.all(
    list.map(async (a) => {
      const [enabled, graduation] = await c.readContract({ address: FACTORY!, abi: FACTORY_ABI, functionName: "pairs", args: [a] });
      if (!enabled) return null;
      if (a.toLowerCase() === ETH_ADDRESS) return { ...DEFAULT_PAIR, graduation };
      const [sym, dec] = await Promise.all([
        c.readContract({ address: a, abi: ERC20_ABI, functionName: "symbol" }),
        c.readContract({ address: a, abi: ERC20_ABI, functionName: "decimals" }),
      ]);
      return { address: a.toLowerCase(), symbol: sym, decimals: Number(dec), graduation };
    }),
  );
  return out.filter((x): x is PairOpt => !!x);
}

/** Launch a token through Kindle's own factory, from the user's own wallet. */
export function LaunchForm() {
  const { navigate } = useApp();
  const account = useAccount();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [image, setImage] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [agree, setAgree] = useState(false);
  const [buyEth, setBuyEth] = useState("");
  const [pairs, setPairs] = useState<PairOpt[]>([]);
  const [pairAddr, setPairAddr] = useState<string>(ETH_ADDRESS);
  const [taxPct, setTaxPct] = useState("0");
  const [buybackPct, setBuybackPct] = useState("0");
  const [status, setStatus] = useState<"" | "signing" | "confirming" | "done">("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ address?: string; txHash?: string } | null>(null);

  const [launchFee, setLaunchFee] = useState<bigint | null>(null);
  useEffect(() => {
    if (!FACTORY) return;
    createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) })
      .readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "launchFee" })
      .then(setLaunchFee)
      .catch(() => {});
    void loadPairs().then(setPairs).catch(() => {});
  }, []);
  const pair = pairs.find((p) => p.address === pairAddr) ?? pairs[0] ?? DEFAULT_PAIR;
  const isEth = pair.address === ETH_ADDRESS;
  const tax = Math.max(0, Math.min(MAX_TAX_PCT, Number(taxPct) || 0));
  const buybackShare = Math.max(0, Math.min(100, Number(buybackPct) || 0));
  const launchFeeText = launchFee ? ` plus a ${formatEther(launchFee)} ETH launch fee` : "";

  // Expected tokens for the creator's first buy on a fresh curve (no anti-snipe tax for the creator).
  const firstBuy = (() => {
    if (!(Number(buyEth) > 0)) return null;
    let amountIn: bigint;
    try {
      amountIn = parseUnits(buyEth, pair.decimals);
    } catch {
      return null;
    }
    const net = amountIn - amountIn / 100n - (amountIn * BigInt(Math.round(tax * 100))) / 10000n;
    const v0 = virtualQuote(pair.graduation);
    let out = (VIRTUAL_TOKENS_RAW * net) / (v0 + net);
    if (out > CURVE_RAW) out = CURVE_RAW;
    return { amountIn, out, pct: Number((out * 10000n) / (1_000_000_000n * 10n ** 18n)) / 100 };
  })();

  const imageOk = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/\S+$/i.test(image);

  async function upload(file: File) {
    setImageError("");
    setImage("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    if (file.size > 1024 * 1024) return setImageError("The image must be 1 MB or smaller.");
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return setImageError("Use a PNG, JPG, GIF or WebP image.");
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Upload failed. Try again.");
      setImage(j.url);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }
  const valid = name.trim().length >= 2 && /^[A-Za-z0-9]{2,12}$/.test(symbol.trim()) && imageOk && agree;

  const launch = async () => {
    setError("");
    if (!account) return setError("Connect your wallet first.");
    if (!valid) return setError("Fill in a name, a 2–12 character ticker, an uploaded image, and tick the box.");
    const eth = getWallet();
    if (!eth) return setError("No browser wallet found. Open this page in your wallet app's browser.");
    setStatus("signing");
    try {
      await ensureChain(eth, "robinhood");
      const wallet = createWalletClient({
        account: account as Address,
        chain: robinhood,
        transport: custom(eth as unknown as Parameters<typeof custom>[0]),
      });
      const publicClient = createPublicClient({ chain: robinhood, transport: http(NETWORKS.robinhood.rpc) });
      if (!FACTORY) throw new Error("Launching opens soon — the Kindle factory isn't live yet.");
      const fee = await publicClient.readContract({ address: FACTORY, abi: FACTORY_ABI, functionName: "launchFee" });
      const buyAmount = firstBuy?.amountIn ?? 0n;
      if (!isEth && buyAmount > 0n) {
        const allowance = await publicClient.readContract({
          address: pair.address as Address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [account as Address, FACTORY],
        });
        if (allowance < buyAmount) {
          const { request: ap } = await publicClient.simulateContract({
            account: account as Address,
            address: pair.address as Address,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [FACTORY, buyAmount],
          });
          await publicClient.waitForTransactionReceipt({ hash: await wallet.writeContract(ap) });
        }
      }
      const { request } = await publicClient.simulateContract({
        account: account as Address,
        address: FACTORY,
        abi: FACTORY_ABI,
        functionName: "launch",
        args: [
          {
            name: name.trim(),
            symbol: symbol.trim().toUpperCase(),
            image: image.trim(),
            quote: pair.address as Address,
            taxBps: Math.round(tax * 100),
            buybackBps: Math.round(buybackShare * 100),
            buyAmount,
            minTokensOut: firstBuy ? (firstBuy.out * 95n) / 100n : 0n,
          },
        ],
        value: fee + (isEth ? buyAmount : 0n),
      });
      const txHash = await wallet.writeContract(request);
      setStatus("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("The launch transaction failed on-chain.");
      const ev = parseEventLogs({ abi: FACTORY_ABI, eventName: "Launched", logs: receipt.logs })[0];
      setResult({ address: ev?.args.token, txHash });
      setStatus("done");
    } catch (e) {
      const rejected = (e as { code?: number }).code === 4001 || /rejected|denied/i.test(errText(e));
      setError(rejected ? "You rejected the transaction in your wallet." : errText(e));
      setStatus("");
    }
  };

  const field = "h-12 w-full rounded-2xl border border-ink/15 bg-paper px-4 outline-none focus:border-coral";

  if (status === "done" && result) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-paper p-6">
        <p className="flex items-center gap-2 text-xl font-bold">
          <Check className="size-6 text-[#0a8f4a]" /> ${symbol.toUpperCase()} is live on Robinhood Chain
        </p>
        {result.address && (
          <p className="mt-3 break-all font-mono text-sm">
            Contract: <span className="font-semibold">{result.address}</span>
          </p>
        )}
        <p className="mt-2 text-sm opacity-75">Share this exact address from your own accounts so people can find the real token.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {result.address && (
            <button
              type="button"
              onClick={() => navigate(`/token/${result.address}`)}
              className="inline-flex h-12 items-center rounded-full bg-coral px-5 text-sm font-bold text-[#0b0b0b]"
            >
              Open token page
            </button>
          )}
          {result.txHash && (
            <a
              href={`${NETWORKS.robinhood.explorer}/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center rounded-full border border-ink/20 px-5 text-sm font-bold"
            >
              View transaction
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void launch();
      }}
      className="space-y-4 rounded-3xl border border-ink/10 bg-paper/70 p-5 md:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Token name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Kindle Cat" className={`${field} mt-1 font-normal`} />
        </label>
        <label className="block text-sm font-semibold">
          Ticker
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12))}
            placeholder="KCAT"
            className={`${field} mt-1 font-normal uppercase`}
          />
        </label>
      </div>
      <div className="block text-sm font-semibold">
        Image
        <label
          className={`mt-1 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-3 transition-colors hover:bg-current/5 ${imageError ? "border-red-500/60" : "border-current/25"}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-current/10">
              <ImagePlus className="size-6 opacity-60" />
            </span>
          )}
          <span className="min-w-0 font-normal">
            <span className="block font-semibold">
              {uploading ? "Uploading…" : image ? "Image ready — tap to change" : "Add image file"}
            </span>
            <span className="block text-xs opacity-60">Square PNG, JPG, GIF or WebP, up to 1 MB</span>
          </span>
          {uploading && <Loader2 className="ml-auto size-5 shrink-0 animate-spin opacity-60" />}
          {image && !uploading && <Check className="ml-auto size-5 shrink-0 text-[#3d7a00]" />}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {imageError && (
          <span role="alert" className="mt-1 block text-xs font-normal text-red-500">
            {imageError}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-semibold">
          Pair
          <select
            value={pair.address}
            onChange={(e) => setPairAddr(e.target.value)}
            className={`${field} mt-1 font-normal`}
          >
            {(pairs.length ? pairs : [DEFAULT_PAIR]).map((p) => (
              <option key={p.address} value={p.address}>
                {p.symbol}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Creator tax (0–{MAX_TAX_PCT}%)
          <input
            value={taxPct}
            onChange={(e) => setTaxPct(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className={`${field} mt-1 font-normal`}
          />
        </label>
        <label className="block text-sm font-semibold">
          Auto-buyback (% of fees)
          <input
            value={buybackPct}
            onChange={(e) => setBuybackPct(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className={`${field} mt-1 font-normal`}
          />
        </label>
      </div>
      <p className="-mt-2 text-xs opacity-70">
        Pair: what {symbol.toUpperCase() || "your token"} trades against; it graduates when the curve has raised{" "}
        {Number(formatUnits(pair.graduation, pair.decimals)).toLocaleString("en-US")} {pair.symbol}. Tax: extra % on every trade, all to
        you, on the curve and in the pool. Auto-buyback: when fees are claimed, this share buys {symbol.toUpperCase() || "your token"} back
        and locks it for {VEST_YEARS} years.
      </p>

      <label className="block text-sm font-semibold">
        First buy (optional, {pair.symbol})
        <input
          value={buyEth}
          onChange={(e) => setBuyEth(e.target.value.replace(/[^0-9.]/g, ""))}
          inputMode="decimal"
          placeholder="0.0"
          className={`${field} mt-1 font-normal`}
        />
        <span className="mt-1 block text-xs font-normal opacity-70">
          {firstBuy
            ? `≈ ${Math.floor(Number(firstBuy.out / 10n ** 18n)).toLocaleString("en-US")} ${symbol.toUpperCase() || "tokens"} (${firstBuy.pct}% of supply), bought in the same transaction — before anyone else, with no anti-snipe tax.`
            : "Buy in the same transaction as the launch, before anyone else."}
        </span>
      </label>

      <ul className="space-y-1 rounded-2xl bg-peach/60 p-4 text-sm">
        <li>• 1,000,000,000 tokens. 800M are sold on a bonding curve; no team allocation.</li>
        <li>
          • When the curve sells out, the token graduates: the last 200M tokens and the {pair.symbol} raised go into a Uniswap v4 pool,
          and the liquidity is locked forever.
        </li>
        <li>
          • Every trade pays {POOL_FEE_PCT}% ({100 - PROTOCOL_SHARE_BPS / 100}% to you, {PROTOCOL_SHARE_BPS / 100}% to Kindle)
          {tax > 0 ? ` plus your ${tax}% tax` : ""}. Your fees wait in escrow until you claim them.
        </li>
        <li>• Buyers in the first {SNIPE_WINDOW_S} seconds pay an anti-snipe tax that falls to 0 — it stops bots grabbing your launch.</li>
        <li>• You pay gas{launchFeeText}. Your wallet shows the total before you sign.</li>
      </ul>
      {FACTORY ? (
        <p className="break-all text-xs opacity-60">
          Factory:{" "}
          <a href={`${NETWORKS.robinhood.explorer}/address/${FACTORY}`} target="_blank" rel="noreferrer" className="font-mono underline">
            {FACTORY}
          </a>
        </p>
      ) : (
        <p className="rounded-2xl border border-ink/15 p-3 text-sm font-semibold">Launching opens soon — the Kindle factory isn&apos;t live yet.</p>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-5 accent-[#ccff00]" />
        <span>I understand this token is permanent and public, and that I&apos;m responsible for what I launch.</span>
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-[#c62828]">
          {error}
        </p>
      )}

      {!account ? (
        <WalletButton tone="blue" className="h-12 w-full justify-center" />
      ) : (
        <button
          type="submit"
          disabled={status !== ""}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-bold text-[#0b0b0b] disabled:opacity-60"
        >
          {status ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {status === "signing" ? "Confirm in your wallet…" : status === "confirming" ? "Launching on Robinhood Chain…" : "Launch token"}
        </button>
      )}
    </form>
  );
}
