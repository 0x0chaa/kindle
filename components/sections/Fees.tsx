"use client";

import { fees } from "@/lib/launchpad-content";

export function Fees() {
  return (
    <section id="fees" className="relative px-[5vw] py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Fees</span>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <h2 className="display whitespace-nowrap text-[clamp(2.6rem,5.5vw,5rem)] leading-[0.95] md:col-span-6">
            Simple,
            <br />
            on-chain fees.
          </h2>
          <p className="max-w-xl text-lg leading-relaxed opacity-80 md:col-span-6 md:text-xl">
            0.0005 ETH to launch. Every trade pays 1% — 70% to the creator or its holders, 30% to Kindle — plus an optional tax of up to 10%.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fees.map((f) => (
            <article key={f.title} className="h-full rounded-3xl border border-current/10 bg-paper p-6">
              <p className="text-sm opacity-60">{f.title}</p>
              <p className="display mt-2 text-[1.9rem] leading-tight text-[#3d7a00]">{f.value}</p>
              <p className="mt-3 text-sm leading-relaxed opacity-75">{f.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs opacity-50">Fees are set in Kindle&apos;s factory contract on Robinhood Chain and shown before you sign.</p>
      </div>
    </section>
  );
}
