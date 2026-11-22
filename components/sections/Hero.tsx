"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TokenCA } from "../TokenCA";
import { HeroArt } from "../HeroArt";
import { KINDLE_BUY_URL, KINDLE_SYMBOL } from "@/lib/token";
import type { TokenRow } from "../token/types";

const fmt = (n: number | null) => (n == null ? "–" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);

/** Editorial hero: live ticker, a night landscape lit by a spark, a serif headline. Static, no animation. */
export function Hero() {
  const [ticker, setTicker] = useState<TokenRow[]>([]);

  useEffect(() => {
    let live = true;
    fetch("/api/tokens?tab=trending")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d?.tokens && setTicker((d.tokens as TokenRow[]).slice(0, 12)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <section id="top" data-tone="dark" data-scene="hero" className="kh relative">
      {ticker.length > 0 && (
        <div className="kh-ticker" aria-label="Trending tokens">
          {ticker.map((t) => (
            <Link key={t.address} href={`/token/${t.address}`}>
              <b>{t.symbol}</b> {fmt(t.marketCap)}{" "}
              {t.change24h != null && (
                <em className={t.change24h >= 0 ? "up" : "dn"}>
                  {t.change24h >= 0 ? "+" : "−"}
                  {Math.abs(t.change24h).toFixed(1)}%
                </em>
              )}
            </Link>
          ))}
        </div>
      )}

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
          <p className="kh-lead">A meme, a community, an idea: Kindle gives it a token, a locked pool and a market in one transaction.</p>
          {KINDLE_BUY_URL && (
            <a className="kh-link mt-5 inline-block" href={KINDLE_BUY_URL} target="_blank" rel="noreferrer">
              Buy ${KINDLE_SYMBOL}
            </a>
          )}
          <TokenCA tone="dark" className="mt-6 max-w-xl" />
        </div>
      </div>

    </section>
  );
}
