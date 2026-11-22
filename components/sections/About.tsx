"use client";

import { FadeIn, Marquee, ScrubText, SplitText } from "../Text";
import { needs } from "@/lib/content";


export function About() {
  return (
    <section id="about" data-tone="dark" data-scene="about" className="relative pt-[16vh] md:pt-[22vh]">
      <div className="grid gap-12 px-[5vw] md:grid-cols-12">
        <FadeIn className="flex items-start justify-between text-sm md:col-span-4 md:flex-col md:gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-60">Introduction</span>
        </FadeIn>

        <div className="md:col-span-8">
          <SplitText
            as="h2"
            type="chars"
            text={["Launch on", "Robinhood."]}
            className="display text-[clamp(2.8rem,8.6vw,9.5rem)]"
          />
          <ScrubText
            className="mt-12 max-w-[26ch] text-[clamp(1.5rem,3vw,2.9rem)] font-medium leading-[1.15] tracking-tight md:mt-16"
            text="Kindle is a friendly launchpad for Robinhood Chain. Tokens launch through Kindle’s own factory straight into a Uniswap v4 pool — no bonding curve, liquidity from the first block. To launch, you need just four things."
          />

          <div className="mt-16 grid gap-8 border-t hairline pt-10 sm:grid-cols-2 xl:grid-cols-4">
            {needs.map((p, i) => (
              <FadeIn key={p.t} delay={i * 0.1}>
                <span className="mb-3 block font-mono text-xs opacity-50">0{i + 1}</span>
                <h3 className="mb-3 text-lg font-semibold tracking-tight">{p.t}</h3>
                <p className="text-sm leading-relaxed opacity-70">{p.d}</p>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      <Marquee
        className="mt-[14vh] border-y hairline py-6 text-[clamp(2.5rem,7vw,6.5rem)]"
        items={["Launch", "Trade", "Earn", "Robinhood Chain", "Locked LP", "Uniswap v4"]}
      />
    </section>
  );
}
