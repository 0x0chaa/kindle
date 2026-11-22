"use client";

import { useEffect, useState } from "react";
import { createPublicClient, encodeDeployData, http, isAddress, type Abi, type Address, type Hex } from "viem";
import { Check, Copy, Loader2 } from "lucide-react";
import { WalletButton } from "../WalletButton";
import { useAccount } from "@/lib/wallet-store";
import { deployWithWallet } from "@/lib/wallet";
import { NETWORKS } from "@/lib/networks";
import { FACTORY, POOL_MANAGER, PROTOCOL_SHARE_BPS } from "@/lib/factory";

type Build = { abi: Abi; bytecode: Hex; compiler: string; source: string };

export function FactoryDeploy() {
  const account = useAccount();
  const [build, setBuild] = useState<Build | null>(null);
  const [treasury, setTreasury] = useState("");
  const [status, setStatus] = useState<"" | "compiling" | "signing" | "confirming">("");
  const [error, setError] = useState("");
  const [deployed, setDeployed] = useState<{ address?: string; tx: string } | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (account && !treasury) setTreasury(account);
  }, [account, treasury]);

  const compile = async () => {
    setStatus("compiling");
    const res = await fetch("/api/factory/compile");
    const d = (await res.json()) as Build & { error?: string };
    if (!res.ok || d.error) throw new Error(d.error || "Compile failed.");
    setBuild(d);
    return d;
  };

  const deploy = async () => {
    setError("");
    try {
      if (!account) throw new Error("Connect your wallet first.");
      if (!isAddress(treasury)) throw new Error("Enter a valid treasury address.");
      const b = build ?? (await compile());
      const data = encodeDeployData({ abi: b.abi, bytecode: b.bytecode, args: [POOL_MANAGER, treasury as Address, PROTOCOL_SHARE_BPS] });
      setStatus("signing");
      const tx = await deployWithWallet("robinhood", account, data);
      setStatus("confirming");
      const c = createPublicClient({ transport: http(NETWORKS.robinhood.rpc) });
      const r = await c.waitForTransactionReceipt({ hash: tx });
      if (r.status !== "success") throw new Error("The deployment failed on-chain.");
      setDeployed({ address: r.contractAddress ?? undefined, tx });
    } catch (e) {
      const m = (e as Error).message ?? "Failed.";
      setError((e as { code?: number }).code === 4001 || /rejected|denied/i.test(m) ? "You rejected the transaction." : m);
    }
    setStatus("");
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  const field = "h-12 w-full rounded-2xl border border-ink/15 bg-paper px-4 font-mono text-sm outline-none focus:border-coral";

  return (
    <div className="space-y-4 rounded-3xl border border-ink/10 bg-paper/70 p-5 md:p-6">
      {FACTORY && (
        <p className="rounded-2xl bg-peach/60 p-4 text-sm">
          A factory is already set for this site: <span className="break-all font-mono">{FACTORY}</span>. Deploying again creates a
          second, separate factory.
        </p>
      )}

      {deployed ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-lg font-bold">
            <Check className="size-5 text-[#0a8f4a]" /> Factory deployed
          </p>
          {deployed.address && (
            <button type="button" onClick={() => copy("addr", deployed.address!)} className="flex w-full items-center gap-2 break-all rounded-2xl border border-ink/15 p-3 text-left font-mono text-sm">
              {copied === "addr" ? <Check className="size-4 shrink-0" /> : <Copy className="size-4 shrink-0" />} {deployed.address}
            </button>
          )}
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Vercel → Settings → Environment Variables → add NEXT_PUBLIC_KINDLE_FACTORY = this address.</li>
            <li>Redeploy the site.</li>
            <li>Verify the contract on Blockscout with the source below (compiler {build?.compiler}).</li>
          </ol>
          <a href={`${NETWORKS.robinhood.explorer}/tx/${deployed.tx}`} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full border border-ink/20 px-5 text-sm font-bold">
            View transaction
          </a>
        </div>
      ) : (
        <>
          <ul className="space-y-1 text-sm">
            <li>• Bonding curve: 800M tokens, graduates at ~4.2 ETH into a locked Uniswap v4 pool (token / ETH, 1%).</li>
            <li>• Trading fees (1%): {100 - PROTOCOL_SHARE_BPS / 100}% to the creator, {PROTOCOL_SHARE_BPS / 100}% to the treasury below.</li>
            <li>• Launch fee starts at 0 (owner can set up to 0.01 ETH).</li>
            <li>• The contract is not audited. Get an audit before promoting it widely.</li>
          </ul>
          <label className="block text-sm font-semibold">
            Treasury (receives Kindle&apos;s share)
            <input value={treasury} onChange={(e) => setTreasury(e.target.value.trim())} placeholder="0x…" className={`${field} mt-1`} />
          </label>
          {error && (
            <p role="alert" className="whitespace-pre-wrap text-sm font-semibold text-[#c62828]">
              {error}
            </p>
          )}
          {!account ? (
            <WalletButton tone="blue" className="h-12 w-full justify-center" />
          ) : (
            <button type="button" onClick={() => void deploy()} disabled={status !== ""} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-sm font-bold text-[#0b0b0b] disabled:opacity-60">
              {status && <Loader2 className="size-4 animate-spin" />}
              {status === "compiling" ? "Compiling…" : status === "signing" ? "Confirm in your wallet…" : status === "confirming" ? "Deploying…" : "Deploy factory on Robinhood Chain"}
            </button>
          )}
        </>
      )}

      {build && (
        <button type="button" onClick={() => copy("src", build.source)} className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/20 px-5 text-sm font-bold">
          {copied === "src" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy source for verification
        </button>
      )}
    </div>
  );
}
