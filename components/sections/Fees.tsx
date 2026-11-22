"use client";

import { FadeIn, SplitText } from "../Text";
import { fees } from "@/lib/launchpad-content";

export function Fees() {
  return (
    <section id="fees" data-tone="dark" data-scene="process" className="relative px-[5vw] py-[16vh]">
      <div className="mb-12 grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Fees</span>
          <SplitText as="h2" type="chars" text={["Simple,", "on-chain fees."]} className="display text-[clamp(2.6rem,7vw,7.5rem)]" />
        </div>
        <FadeIn className="md:col-span-4">
          <p className="max-w-sm leading-relaxed opacity-70">
            Launches cost only gas. Every trade pays 1% — 70% to the creator, 30% to Kindle. No taxes.
          </p>
        </FadeIn>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fees.map((f, i) => (
          <FadeIn key={f.title} delay={(i % 3) * 0.08}>
            <article className="h-full rounded-3xl border border-current/10 bg-paper p-6">
              <p className="text-sm opacity-60">{f.title}</p>
              <p className="display mt-2 text-4xl text-[#3d7a00]">{f.value}</p>
              <p className="mt-3 text-sm leading-relaxed opacity-75">{f.text}</p>
            </article>
          </FadeIn>
        ))}
      </div>
      <p className="mt-6 text-xs opacity-50">Fees are fixed in Kindle&apos;s factory contract on Robinhood Chain.</p>
    </section>
  );
}
