"use client";

import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, defineChain, formatEther, http, parseEventLogs, type Address } from "viem";
import { Check, Loader2, Rocket } from "lucide-react";
import { useApp } from "../Providers";
import { WalletButton } from "../WalletButton";
import { TokenAvatar } from "../token/TokenAvatar";
import { useAccount } from "@/lib/wallet-store";
import { ensureChain, getWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { FACTORY, FACTORY_ABI, PROTOCOL_SHARE_BPS, POOL_FEE_PCT } from "@/lib/factory";

const robinhood = defineChain({
  id: NETWORKS.robinhood.chainId,
  name: NETWORKS.robinhood.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [NETWORKS.robinhood.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: NETWORKS.robinhood.explorer } },
});

const errText = (e: unknown) =>
  typeof e === "string" ? e : e instanceof Error ? e.message : (e as { message?: string })?.message ?? "The launch failed.";

/** Launch a token through Kindle's own factory, from the user's own wallet. */
export function LaunchForm() {
  const { navigate } = useApp();
  const account = useAccount();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [image, setImage] = useState("");
  const [agree, setAgree] = useState(false);
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
  }, []);
  const launchFeeText = launchFee ? ` plus a ${formatEther(launchFee)} ETH launch fee` : "";

  const imageOk = /^https:\/\/\S+$/.test(image.trim()) || /^ipfs:\/\/\S+$/.test(image.trim());
  const valid = name.trim().length >= 2 && /^[A-Za-z0-9]{2,12}$/.test(symbol.trim()) && imageOk && agree;

  const launch = async () => {
    setError("");
    if (!account) return setError("Connect your wallet first.");
    if (!valid) return setError("Fill in a name, a 2–12 character ticker, an https image link, and tick the box.");
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
      const { request } = await publicClient.simulateContract({
        account: account as Address,
        address: FACTORY,
        abi: FACTORY_ABI,
        functionName: "launch",
        args: [name.trim(), symbol.trim().toUpperCase(), image.trim(), 0n],
        value: fee,
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
            placeholder="MCAT"
            className={`${field} mt-1 font-normal uppercase`}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Image link (square, https or ipfs)
        <div className="mt-1 flex items-center gap-3">
          <TokenAvatar src={imageOk ? image.trim() : null} symbol={symbol || "?"} className="size-12 shrink-0" />
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/token.png" className={`${field} font-normal`} />
        </div>
      </label>

      <ul className="space-y-1 rounded-2xl bg-peach/60 p-4 text-sm">
        <li>• 1,000,000,000 tokens, all placed in a Uniswap v4 pool paired with ETH. No team allocation.</li>
        <li>• The liquidity is locked forever — Kindle&apos;s factory has no function to remove it.</li>
        <li>
          • Every swap pays a {POOL_FEE_PCT}% pool fee: {100 - PROTOCOL_SHARE_BPS / 100}% of it goes to you, {PROTOCOL_SHARE_BPS / 100}% to Kindle.
        </li>
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
