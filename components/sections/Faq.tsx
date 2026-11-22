"use client";

import { Plus } from "lucide-react";
import { FadeIn, SplitText } from "../Text";
import { faqs } from "@/lib/launchpad-content";

export function Faq() {
  return (
    <section id="faq" data-tone="light" className="relative px-[5vw] py-[16vh]">
      <div className="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">FAQ</span>
          <SplitText as="h2" type="chars" text={["Good", "questions."]} className="display text-[clamp(2.6rem,6.5vw,6.5rem)]" />
        </div>
        <FadeIn className="md:col-span-8">
          <ul className="divide-y divide-ink/10 border-y border-ink/10">
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
        </FadeIn>
      </div>
    </section>
  );
}
