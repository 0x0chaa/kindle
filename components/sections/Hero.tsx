"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { TokenCA } from "../TokenCA";
import { HeroArt } from "../HeroArt";
import { KINDLE_BUY_URL, KINDLE_SYMBOL } from "@/lib/token";
import type { TokenRow } from "../token/types";

const fmt = (n: number | null) => (n == null ? "–" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);

// Shown in the ticker until there are tokens to list.
const FACTS = [
  "Launch in one transaction",
  "Bonding curve → Uniswap v4",
  "1% trading fee, no tax",
  "70% of fees to the creator",
  "Graduates at ~4.2 ETH",
  "Anti-snipe launches",
];

/** Repeat a short list so one copy is always wider than the screen (no gap in the loop). */
const fill = <T,>(list: T[], min = 10): T[] => {
  if (!list.length) return list;
  const out: T[] = [];
  while (out.length < min) out.push(...list);
  return out;
};

/** Editorial hero: live ticker, a night landscape lit by a spark, a serif headline. Static, no animation. */
export function Hero() {
  const [ticker, setTicker] = useState<TokenRow[]>([]);

  useEffect(() => {
    let live = true;
    fetch("/api/tokens?tab=trending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d?.tokens && setTicker((d.tokens as TokenRow[]).slice(0, 20)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="top" className="kh relative">
      <div className="kh-ticker" aria-label={ticker.length ? "Trending tokens" : "About Kindle"}>
        {/* two identical copies, slid left by exactly one copy, loop without a seam */}
        <div className="kh-track">
          {[0, 1].map((copy) => (
            <div key={copy} className="kh-run" aria-hidden={copy === 1}>
              {ticker.length > 0
                ? fill(ticker).map((t, i) => (
                    <Link key={`${t.address}-${i}`} href={`/token/${t.address}`} tabIndex={copy === 1 ? -1 : undefined}>
                      <b>{t.symbol}</b> {fmt(t.marketCap)}{" "}
                      {t.change24h != null && (
                        <em className={t.change24h >= 0 ? "up" : "dn"}>
                          {t.change24h >= 0 ? "+" : "−"}
                          {Math.abs(t.change24h).toFixed(1)}%
                        </em>
                      )}
                    </Link>
                  ))
                : fill(FACTS).map((f, i) => (
                    <span key={`${f}-${i}`}>
                      <i className="dot" />
                      {f}
                    </span>
                  ))}
            </div>
          ))}
        </div>
      </div>

      <div className="kh-art">
        <HeroArt />
        <div className="kh-copy">
          <h1 className="kh-title">
            Every launch starts
            <br />
            with a <i>spark</i> on
            <br />
            Robinhood Chain
          </h1>
          <p className="kh-lead">A meme, a community, an idea: Kindle turns it into a token and a market in one transaction — and a locked Uniswap v4 pool when it graduates.</p>
          <Link
            href="/launch"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-coral px-6 text-sm font-bold text-[#0b0b0b] shadow-[0_0_24px_rgba(204,255,0,0.35)]"
          >
            <Rocket className="size-4" /> Launch a token
          </Link>
          {KINDLE_BUY_URL && (
            <a className="kh-link mt-5 inline-block" href={KINDLE_BUY_URL} target="_blank" rel="noreferrer">
              Buy ${KINDLE_SYMBOL}
            </a>
          )}
          <TokenCA className="mt-6 max-w-xl" />
        </div>
      </div>

    </section>
  );
}
