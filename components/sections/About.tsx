"use client";

import { needs } from "@/lib/content";

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
          <p className="max-w-xl text-lg leading-relaxed opacity-80 md:col-span-6 md:text-xl">
            Kindle is a launchpad for Robinhood Chain. Tokens launch on a fair bonding curve and graduate to a locked Uniswap v4 pool when
            it sells out. To launch, you need just four things.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
