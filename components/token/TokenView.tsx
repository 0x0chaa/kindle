"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink } from "lucide-react";
import { useApp } from "../Providers";
import { TokenAvatar } from "./TokenAvatar";
import { SwapBox } from "./SwapBox";
import { CollectFees } from "./CollectFees";
import type { TokenRow } from "./types";
import { age, pct, usd } from "@/lib/format";
import { NETWORKS } from "@/lib/networks";
import { cn } from "@/lib/utils";

export function TokenView({ token }: { token: TokenRow }) {
  const { navigate } = useApp();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy the contract address:", token.address);
    }
  };

  const stats: [string, string, string?][] = [
    ["Price", usd(token.priceUsd, 6)],
    ["Market cap", usd(token.marketCap)],
    ["24h volume", usd(token.volume24h)],
    ["24h change", pct(token.change24h), (token.change24h ?? 0) > 0 ? "text-[#0a8f4a]" : (token.change24h ?? 0) < 0 ? "text-[#c62828]" : ""],
    ["Liquidity", usd(token.liquidityUsd)],
    ["Age", age(token.createdAt)],
  ];
  const links = [
    ...(token.dexUrl ? [{ label: "DexScreener", url: token.dexUrl }] : []),
    { label: "Explorer", url: `${NETWORKS.robinhood.explorer}/token/${token.address}` },
    ...token.websites.map((w) => ({ label: w.label, url: w.url })),
    ...token.socials.map((s) => ({ label: s.type[0].toUpperCase() + s.type.slice(1), url: s.url })),
  ];

  return (
    <section data-tone="light" className="relative min-h-[100svh] px-[5vw] pb-20 pt-28">
      <button
        type="button"
        onClick={() => navigate("/#tokens")}
        className="mb-8 inline-flex items-center gap-2 text-sm font-semibold opacity-70 hover:opacity-100"
      >
        <ArrowLeft className="size-4" /> All tokens
      </button>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-5">
            <TokenAvatar src={token.image} symbol={token.symbol} className="size-20 text-xl" />
            <div className="min-w-0">
              <h1 className="display text-[clamp(2.2rem,6vw,4.5rem)] leading-none">{token.name}</h1>
              <p className="mt-1 text-lg font-semibold opacity-70">${token.symbol} · Robinhood Chain</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-paper px-4 py-3">
            <span className="text-xs opacity-60">Contract</span>
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{token.address}</code>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-coral px-3 text-sm font-semibold text-ink"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map(([k, v, cls]) => (
              <div key={k} className="rounded-2xl border border-ink/10 bg-paper p-4">
                <dt className="text-xs opacity-60">{k}</dt>
                <dd className={cn("mt-1 text-lg font-bold", cls)}>{v}</dd>
              </div>
            ))}
          </dl>

          {token.pairAddress ? (
            <div className="overflow-hidden rounded-3xl border border-ink/10 bg-ink">
              <iframe
                title={`${token.symbol} price chart`}
                src={`https://dexscreener.com/robinhood/${token.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
                className="h-[460px] w-full"
                loading="lazy"
              />
            </div>
          ) : (
            <p className="rounded-3xl border border-ink/10 bg-paper p-6 text-sm opacity-75">
              No chart yet — trading data appears a few minutes after the first trades.
            </p>
          )}

          {token.description && (
            <div className="rounded-3xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-2 font-bold">About</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed opacity-80">{token.description}</p>
            </div>
          )}

          <ul className="flex flex-wrap gap-2">
            {links.map((l) => (
              <li key={l.label + l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/15 bg-paper px-4 text-sm font-semibold hover:border-coral"
                >
                  {l.label} <ExternalLink className="size-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <SwapBox address={token.address} symbol={token.symbol} />
            {token.isKindle && <CollectFees address={token.address} />}
            <p className="mt-4 text-xs leading-relaxed opacity-60">
              Anyone can launch a token on Kindle. Kindle doesn&apos;t vet tokens — check the contract address and do your
              own research before you buy.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
