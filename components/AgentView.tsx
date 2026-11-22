"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Agent } from "@/lib/content";
import { ProjectArt } from "./ProjectArt";
import { FadeIn, SplitText } from "./Text";
import { useApp } from "./Providers";
import { Pill } from "./Pill";

export function AgentView({ agent: p, next }: { agent: Agent; next: Agent }) {
  const root = useRef<HTMLDivElement>(null);
  const { navigate, reduced } = useApp();

  useGSAP(
    () => {
      if (reduced) return;
      gsap.fromTo(
        ".pv-cover",
        { clipPath: "inset(18% 12% 0% 12% round 48px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 32px)",
          ease: "none",
          scrollTrigger: { trigger: ".pv-cover", start: "top bottom", end: "top 15%", scrub: true },
        },
      );
      gsap.fromTo(
        ".pv-cover-art",
        { yPercent: -12, scale: 1.2 },
        {
          yPercent: 12,
          scale: 1,
          ease: "none",
          scrollTrigger: { trigger: ".pv-cover", start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <div ref={root}>
      <section data-tone="dark" className="relative flex min-h-[88svh] flex-col justify-end overflow-hidden px-[5vw] pb-14 pt-32">
        <div className="aura" aria-hidden />
        <a
          href="/#work"
          onClick={(e) => {
            e.preventDefault();
            navigate("/#work");
          }}
          className="group relative mb-auto inline-flex w-fit items-center gap-2 text-sm opacity-70 hover:opacity-100"
        >
          <ArrowLeft className="size-4 transition-transform duration-500 group-hover:-translate-x-1" />
          All agents
        </a>
        <div className="relative mb-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-xs uppercase tracking-[0.18em] opacity-60">
          <span>{p.category}</span>
          <span>{p.trigger}</span>
          <span>{p.kind}</span>
        </div>
        <SplitText as="h1" type="chars" trigger="ready" delay={0.6} text={p.title} className="display relative text-[clamp(3rem,12vw,13rem)]" />
        <FadeIn delay={0.9} className="relative">
          <p className="mt-8 max-w-xl text-lg leading-relaxed opacity-75 md:text-xl">{p.description}</p>
        </FadeIn>
      </section>

      <div className="px-[5vw]">
        <div className="pv-cover relative aspect-[4/5] overflow-hidden rounded-[32px] sm:aspect-[16/9]">
          <div className="pv-cover-art absolute inset-0">
            <ProjectArt project={p} />
          </div>
        </div>
      </div>

      <section data-tone="light" className="px-[5vw] py-[16vh]">
        <div className="grid gap-12 md:grid-cols-12">
          <FadeIn className="md:col-span-4">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] opacity-60">Connects to</h2>
            <ul className="space-y-2 text-lg">
              {p.tools.map((d) => (
                <li key={d} className="border-b hairline pb-2">
                  {d}
                </li>
              ))}
            </ul>
          </FadeIn>
          <div className="space-y-14 md:col-span-7 md:col-start-6">
            <FadeIn>
              <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] opacity-60">The job</h2>
              <p className="text-[clamp(1.4rem,2.4vw,2.2rem)] font-medium leading-snug tracking-tight">{p.job}</p>
            </FadeIn>
            <FadeIn>
              <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] opacity-60">How it runs</h2>
              <p className="text-lg leading-relaxed opacity-80">{p.how}</p>
            </FadeIn>
          </div>
        </div>

        <div className="mt-[12vh] grid gap-4 md:grid-cols-2">
          {[1, 2].map((s) => (
            <FadeIn key={s} delay={s * 0.08}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[28px]">
                <ProjectArt project={p} shift={s} />
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section data-tone="dark" className="relative overflow-hidden px-[5vw] py-[16vh]">
        <a
          href={`/agents/${next.slug}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`/agents/${next.slug}`);
          }}
          data-cursor="Next"
          className="group block"
        >
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">Next agent</span>
          <span className="display flex items-center gap-6 text-[clamp(2.8rem,10vw,11rem)]">
            <span className="transition-transform duration-700 ease-out-expo group-hover:translate-x-4">{next.title}</span>
            <ArrowUpRight className="size-[0.6em] shrink-0 transition-transform duration-700 ease-out-expo group-hover:rotate-45" />
          </span>
        </a>
        <div className="mt-16">
          <Pill href={`/run?template=${p.slug}`} variant="light">
            Run this agent
          </Pill>
        </div>
      </section>
    </div>
  );
}
