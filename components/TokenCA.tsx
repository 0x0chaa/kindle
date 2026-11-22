"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { KINDLE_CA, KINDLE_EXPLORER, KINDLE_SYMBOL, shortAddress } from "@/lib/token";
import { cn } from "@/lib/utils";

/** The official $KINDLE contract address with copy + explorer buttons. Renders nothing until the token is live. */
export function TokenCA({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!KINDLE_CA) return null;
  const dark = tone === "dark";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(KINDLE_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy the contract address:", KINDLE_CA);
    }
  };

  return (
    <div className={cn("max-w-md", className)}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
          dark ? "border-paper/15 bg-paper/[0.06] text-paper" : "border-ink bg-paper text-ink",
        )}
      >
        <div className="min-w-0">
          <p className={cn("text-xs", dark ? "text-paper/60" : "text-ink/70")}>${KINDLE_SYMBOL} contract · Robinhood Chain</p>
          <p className="truncate font-mono text-sm" title={KINDLE_CA}>
            <span className="sm:hidden">{shortAddress(KINDLE_CA)}</span>
            <span className="hidden sm:inline">{KINDLE_CA}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-mint px-3 text-sm font-semibold text-ink"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={KINDLE_EXPLORER}
            target="_blank"
            rel="noreferrer"
            aria-label="View the token on the Robinhood Chain explorer"
            className={cn("grid size-10 place-items-center rounded-xl border", dark ? "border-paper/25" : "border-ink")}
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      </div>
      <p className={cn("mt-2 text-xs", dark ? "text-paper/55" : "text-ink/70")}>
        Only trust this address. Kindle never DMs you first.
      </p>
    </div>
  );
}
