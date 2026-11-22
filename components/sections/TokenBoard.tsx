"use client";

import { useEffect, useState } from "react";
import { Rocket, Search } from "lucide-react";
import { useApp } from "../Providers";
import { FadeIn, SplitText } from "../Text";
import { TokenAvatar } from "../token/TokenAvatar";
import type { Tab, TokenRow } from "../token/types";
import { age, pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "new", label: "New", hint: "Launched in the last 3 days, newest first." },
  { id: "top", label: "Top", hint: "Highest market cap." },
  { id: "trending", label: "Trending", hint: "Most trading volume in the last 24 hours." },
  { id: "graduating", label: "Graduating", hint: "Young tokens closing in on the $69K market-cap milestone." },
  { id: "graduated", label: "Graduated", hint: "Young tokens that passed the $69K market-cap milestone." },
];

export function TokenBoard() {
  const { navigate } = useApp();
  const [tab, setTab] = useState<Tab>("new");
  const [rows, setRows] = useState<TokenRow[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(40);

  useEffect(() => {
    let live = true;
    setRows(null);
    setShown(40);
    setError("");
    fetch(`/api/tokens?tab=${tab}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message ?? "Couldn't load tokens.");
        if (live) setRows(d.tokens as TokenRow[]);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [tab]);

  const open = (address: string) => navigate(`/token/${address}`);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <section id="tokens" data-tone="light" data-scene="work" className="relative px-[5vw] pb-[16vh] pt-6">
      <div className="mb-8 grid gap-8 md:grid-cols-12 md:items-end">
        <FadeIn className="space-y-3 md:col-span-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const a = q.trim();
              if (/^0x[0-9a-fA-F]{40}$/.test(a)) open(a);
            }}
            className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4"
          >
            <Search className="size-4 opacity-60" />
            <label htmlFor="ca-search" className="sr-only">
              Token contract address
            </label>
            <input
              id="ca-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Paste a token address (0x…)"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <a
            href="/launch"
            onClick={(e) => {
              e.preventDefault();
              navigate("/launch");
            }}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-coral px-5 text-sm font-semibold text-[#0b0b0b]"
          >
            <Rocket className="size-4" /> Launch a token
          </a>
        </FadeIn>
      </div>

      <div role="tablist" aria-label="Token lists" className="mb-3 flex gap-2 overflow-x-auto pb-1" data-lenis-prevent>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-11 shrink-0 rounded-full px-5 text-sm font-bold uppercase tracking-wider transition-colors",
              tab === t.id ? "bg-ink text-paper" : "border border-ink/15 bg-paper/60 hover:bg-paper",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-6 text-sm opacity-70">{current.hint}</p>

      {error && (
        <p role="alert" className="rounded-2xl border border-coral/30 bg-paper p-4 text-sm">
          {error} Try again in a moment.
        </p>
      )}

      {!error && rows === null && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-paper/70" />
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="rounded-3xl border border-ink/10 bg-paper p-6 text-sm opacity-80">
          No tokens here right now. Check another tab, or be the first — launch one.
        </p>
      )}

      {rows && rows.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, shown).map((t) => (
            <li key={t.address}>
              <a
                href={`/token/${t.address}`}
                onClick={(e) => {
                  e.preventDefault();
                  open(t.address);
                }}
                data-cursor="hover"
                className="group flex items-center gap-4 rounded-3xl border border-ink/10 bg-paper p-4 transition-colors hover:border-coral"
              >
                <TokenAvatar src={t.image} symbol={t.symbol} className="size-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-bold">{t.name}</p>
                    <span className="shrink-0 font-mono text-xs opacity-60">{age(t.createdAt)}</span>
                  </div>
                  <p className="truncate text-sm opacity-70">${t.symbol}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                    <span>
                      <span className="opacity-60">MC </span>
                      <span className="font-semibold">{usd(t.marketCap)}</span>
                    </span>
                    <span>
                      <span className="opacity-60">Vol </span>
                      <span className="font-semibold">{usd(t.volume24h)}</span>
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        (t.change24h ?? 0) > 0 ? "text-[#0a8f4a]" : (t.change24h ?? 0) < 0 ? "text-[#c62828]" : "opacity-60",
                      )}
                    >
                      {pct(t.change24h)}
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length > shown && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + 40)}
            className="inline-flex h-12 items-center rounded-full bg-coral px-8 text-sm font-bold text-[#0b0b0b]"
          >
            Read more
          </button>
        </div>
      )}
      <p className="mt-6 text-xs opacity-60">
        Token data from Kindle&apos;s factory and DexScreener. Anyone can launch a token — always check the contract address and
        do your own research.
      </p>
    </section>
  );
}
