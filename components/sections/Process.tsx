"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { steps } from "@/lib/content";
import { SplitText } from "../Text";

export function Process() {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          desk: "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
          mob: "(max-width: 899px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          const { desk } = ctx.conditions as { desk: boolean; mob: boolean };
          const panels = gsap.utils.toArray<HTMLElement>(".proc-panel");

          if (desk && track.current) {
            const t = track.current;
            const dist = () => t.scrollWidth - window.innerWidth;
            const tween = gsap.to(t, {
              x: () => -dist(),
              ease: "none",
              scrollTrigger: {
                trigger: ".proc-pin",
                pin: true,
                scrub: 1,
                end: () => `+=${dist()}`,
                invalidateOnRefresh: true,
              },
            });
            panels.forEach((panel) => {
              gsap.from(panel.querySelectorAll(".pc"), {
                yPercent: 120,
                rotate: 12,
                stagger: 0.045,
                duration: 1.1,
                ease: "expo.out",
                scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left 72%" },
              });
              gsap.fromTo(
                panel.querySelector(".proc-num"),
                { xPercent: 25 },
                {
                  xPercent: -25,
                  ease: "none",
                  scrollTrigger: {
                    trigger: panel,
                    containerAnimation: tween,
                    start: "left right",
                    end: "right left",
                    scrub: true,
                  },
                },
              );
            });
            gsap.to(".proc-progress", {
              scaleX: 1,
              ease: "none",
              scrollTrigger: { trigger: ".proc-pin", start: "top top", end: () => `+=${dist()}`, scrub: true },
            });
          } else {
            panels.forEach((panel) => {
              gsap.from(panel.querySelectorAll(".pc"), {
                yPercent: 120,
                stagger: 0.04,
                duration: 1,
                ease: "expo.out",
                scrollTrigger: { trigger: panel, start: "top 80%" },
              });
            });
          }
        },
      );
      return () => mm.revert();
    },
    { scope: wrap },
  );

  return (
    <div ref={wrap} id="process" data-tone="light" data-scene="process" className="relative">
      <section className="proc-pin relative overflow-hidden min-[900px]:h-screen">
        <div ref={track} className="flex flex-col min-[900px]:h-full min-[900px]:w-max min-[900px]:flex-row">
          <div className="flex flex-col justify-center px-[5vw] pb-10 pt-[16vh] min-[900px]:w-[46vw] min-[900px]:py-0">
            <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">
              The agent loop
            </span>
            <SplitText
              as="h2"
              type="chars"
              text={["Plan.", "Act.", "Learn."]}
              className="display text-[clamp(2.6rem,6.4vw,7rem)]"
            />
            <p className="mt-8 max-w-sm leading-relaxed opacity-70">
              Every run follows the same four-step loop. Keep scrolling to follow one through it.
            </p>
          </div>

          {steps.map((s) => (
            <article
              key={s.n}
              className="proc-panel relative flex min-h-[80vh] flex-col justify-end overflow-hidden border-t hairline px-[5vw] pb-14 pt-24 min-[900px]:h-full min-[900px]:min-h-0 min-[900px]:w-[64vw] min-[900px]:border-l min-[900px]:border-t-0 min-[900px]:pb-[14vh]"
            >
              <span
                aria-hidden
                className="proc-num display text-outline pointer-events-none absolute right-[4vw] top-[10vh] text-[clamp(9rem,30vw,30rem)] leading-none"
              >
                {s.n}
              </span>
              <span className="relative mb-4 font-mono text-sm opacity-60">{s.n} —</span>
              <h3 className="display relative overflow-hidden pb-[0.05em] text-[clamp(3.2rem,9vw,10rem)]">
                {[...s.title].map((ch, i) => (
                  <span key={i} className="pc inline-block">
                    {ch}
                  </span>
                ))}
              </h3>
              <p className="relative mt-6 max-w-md text-lg leading-relaxed opacity-75">{s.text}</p>
              <ul className="relative mt-6 flex flex-wrap gap-2">
                {s.tags.map((t) => (
                  <li key={t} className="rounded-full border hairline px-3 py-1 text-xs">
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="absolute inset-x-[5vw] bottom-8 hidden h-px bg-current/15 min-[900px]:block">
          <div className="proc-progress h-full origin-left scale-x-0 bg-gradient-to-r from-coral to-mint" />
        </div>
      </section>
    </div>
  );
}
