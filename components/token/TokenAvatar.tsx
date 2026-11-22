"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Token image with a lettered fallback when it's missing or fails to load. */
export function TokenAvatar({ src, symbol, className }: { src: string | null; symbol: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const ok = src && !broken && /^(https:|ipfs:)/.test(src);
  const url = ok ? src.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") : null;
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className={cn("rounded-2xl object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("grid place-items-center rounded-2xl bg-coral font-bold text-ink", className)}>
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}
