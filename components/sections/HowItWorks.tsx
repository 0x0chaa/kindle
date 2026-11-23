"use client";

import { howItWorks } from "@/lib/content";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-[5vw] py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">How it works</span>
        <div className="grid gap-8 md:grid-cols-12 md:items-end">
          <h2 className="display whitespace-nowrap text-[clamp(2.6rem,5.5vw,5rem)] leading-[0.95] md:col-span-6">
            How it
            <br />
            works.
          </h2>
          <p className="max-w-xl text-lg leading-relaxed opacity-80 md:col-span-6 md:text-xl">
            From an idea to a graduated token in nine steps. Your wallet signs every one — Kindle never holds your keys, your tokens or your
            money.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {howItWorks.map((s, i) => (
            <li key={s.title} className="flex flex-col rounded-3xl border border-ink/10 bg-paper p-6">
              <span className="mb-6 grid size-9 place-items-center rounded-full bg-coral font-mono text-xs font-bold text-[#0b0b0b]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-2 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="text-sm leading-relaxed opacity-70">{s.desc}</p>
              <ul className="mt-auto flex flex-wrap gap-1.5 pt-5">
                {s.tags.map((t) => (
                  <li key={t} className="rounded-full border border-ink/15 px-2.5 py-1 text-xs opacity-80">
                    {t}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
