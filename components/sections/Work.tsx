"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "lucide-react";
import { agents } from "@/lib/content";
import { ProjectArt } from "../ProjectArt";
import { useApp } from "../Providers";
import { FadeIn, SplitText } from "../Text";

export function Work() {
  const root = useRef<HTMLElement>(null);
  const { navigate, reduced } = useApp();

  useGSAP(
    () => {
      if (reduced) return;
      const cards = gsap.utils.toArray<HTMLElement>(".work-card");
      cards.forEach((card, i) => {
        const inner = card.querySelector(".work-inner");
        const art = card.querySelector(".work-art");
        // image reveal: clip opens + art settles
        gsap.fromTo(
          inner,
          { clipPath: "inset(14% 10% 14% 10% round 48px)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 32px)",
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "top 25%", scrub: true },
          },
        );
        gsap.fromTo(
          art,
          { scale: 1.35 },
          {
            scale: 1,
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "top top", scrub: true },
          },
        );
        // stacking: previous card recedes as the next one arrives
        const next = cards[i + 1];
        if (next) {
          gsap.to(inner, {
            scale: 0.9,
            filter: "brightness(0.45)",
            ease: "none",
            scrollTrigger: { trigger: next, start: "top bottom", end: "top 10%", scrub: true },
          });
        }
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section ref={root} id="work" data-tone="dark" data-scene="work" className="relative px-[5vw] py-[16vh]">
      <div className="mb-16 grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">
            Agent templates · {String(agents.length).padStart(2, "0")}
          </span>
          <SplitText
            as="h2"
            type="chars"
            text={["Agents", "at work."]}
            className="display text-[clamp(2.6rem,8.2vw,9rem)]"
          />
        </div>
        <FadeIn className="md:col-span-4">
          <p className="max-w-sm leading-relaxed opacity-70">
            Start from a ready-made agent or build your own. Hover to peek, click to see exactly
            how each one runs.
          </p>
        </FadeIn>
      </div>

      <div className="relative">
        {agents.map((p, i) => (
          <div
            key={p.slug}
            className="work-card sticky top-[9vh] mb-[6vh] h-[76vh] md:h-[82vh]"
            style={{ zIndex: i + 1 }}
          >
            <a
              href={`/agents/${p.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/agents/${p.slug}`);
              }}
              data-cursor="View"
              className="work-inner group relative block h-full origin-top overflow-hidden rounded-[32px] text-paper will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral"
            >
              <div className="work-art absolute inset-0 will-change-transform">
                <div className="absolute inset-0 transition-transform duration-[1400ms] ease-out-expo group-hover:scale-[1.05]">
                  <ProjectArt project={p} />
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-6 text-sm md:p-10">
                <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur-md">{p.category}</span>
                <span className="font-mono">{p.trigger}</span>
              </div>

              <div className="absolute inset-x-0 bottom-0 grid gap-5 p-6 md:grid-cols-12 md:items-end md:p-10">
                <h3 className="display text-[clamp(2.6rem,7.5vw,8rem)] md:col-span-8">
                  <span className="block overflow-hidden">
                    <span className="block transition-transform duration-700 ease-out-expo group-hover:-translate-y-[6%]">
                      {p.title}
                    </span>
                  </span>
                </h3>
                <div className="flex items-end justify-between gap-6 md:col-span-4">
                  <p className="max-w-xs text-sm leading-relaxed text-paper/80">{p.description}</p>
                  <span className="grid size-14 shrink-0 place-items-center rounded-full bg-paper text-ink transition-transform duration-700 ease-out-expo group-hover:rotate-45 group-hover:scale-110">
                    <ArrowUpRight className="size-5" />
                  </span>
                </div>
              </div>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
