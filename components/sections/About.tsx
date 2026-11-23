"use client";

import { highlights, needs } from "@/lib/content";

export function About() {
  return (
    <section id="about" className="relative px-[5vw] pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Introduction</span>

        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <h2 className="display text-[clamp(2.6rem,5.5vw,5rem)] leading-[0.95] md:col-span-6">
            Launch on
            <br />
            Robinhood.
          </h2>
          <div className="max-w-xl space-y-4 text-lg leading-relaxed opacity-80 md:col-span-6 md:text-xl">
            <p>
              Kindle is a token launchpad for Robinhood Chain. Anyone can launch a token in one transaction, trade it on a fair bonding
              curve, and watch it graduate to a locked Uniswap v4 pool when the curve sells out.
            </p>
            <p className="text-base md:text-lg">
              Everything happens from your own wallet. Kindle never holds keys or funds, and every rule — supply, fees, graduation, locked
              liquidity — is fixed in the factory contract on-chain.
            </p>
          </div>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-6 border-y border-ink/10 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h) => (
            <li key={h.t} className="flex gap-3">
              <span className="mt-2 size-2 shrink-0 rounded-full bg-coral shadow-[0_0_8px_#ccff00]" />
              <div>
                <h3 className="font-semibold tracking-tight">{h.t}</h3>
                <p className="mt-1 text-sm leading-relaxed opacity-70">{h.d}</p>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="mt-12 text-xl font-semibold tracking-tight">To launch, you need four things</h3>

        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {needs.map((p, i) => (
            <li key={p.t} className="flex flex-col rounded-3xl border border-ink/10 bg-paper p-6">
              <span className="mb-6 grid size-9 place-items-center rounded-full bg-coral font-mono text-xs font-bold text-[#0b0b0b]">
                0{i + 1}
              </span>
              <h3 className="mb-2 text-lg font-semibold tracking-tight">{p.t}</h3>
              <p className="text-sm leading-relaxed opacity-70">{p.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
