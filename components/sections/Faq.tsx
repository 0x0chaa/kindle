"use client";

import { Plus } from "lucide-react";
import { faqs } from "@/lib/launchpad-content";

export function Faq() {
  return (
    <section id="faq" className="relative px-[5vw] py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <span className="mb-5 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">FAQ</span>
          <h2 className="display whitespace-nowrap text-[clamp(2.4rem,4.2vw,4rem)] leading-[0.95]">
            Good
            <br />
            questions.
          </h2>
        </div>
        <ul className="divide-y divide-ink/10 border-y border-ink/10 md:col-span-8">
          {faqs.map((f) => (
            <li key={f.q}>
              <details className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-bold">
                  {f.q}
                  <Plus className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="mt-3 max-w-2xl leading-relaxed opacity-75">{f.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
