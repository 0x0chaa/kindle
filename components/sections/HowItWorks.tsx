"use client";

import { useRef, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { howItWorks } from "@/lib/content";
import { StepVisual } from "../StepVisual";
import { FadeIn, SplitText } from "../Text";
import { EASE_EXPO } from "@/lib/utils";

function StepCard({ s, i }: { s: (typeof howItWorks)[number]; i: number }) {
  const ref = useRef<HTMLElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 160, damping: 18 });
  const sry = useSpring(ry, { stiffness: 160, damping: 18 });

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 12);
    rx.set(-(py - 0.5) * 12);
    ref.current.style.setProperty("--mx", `${px * 100}%`);
    ref.current.style.setProperty("--my", `${py * 100}%`);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.article
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 1.1, delay: (i % 3) * 0.1, ease: EASE_EXPO }}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1000 }}
      data-cursor="hover"
      className="group relative overflow-hidden rounded-[28px] border hairline bg-paper/50 p-5 [transform-style:preserve-3d] md:p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(204,255,0,.22), transparent 45%)",
        }}
      />
      <div className="relative mb-6 h-48 overflow-hidden rounded-2xl bg-paper/60 [transform:translateZ(36px)] md:h-52">
        <StepVisual kind={s.visual} />
      </div>
      <div className="relative flex items-start justify-between gap-4 [transform:translateZ(24px)]">
        <div>
          <span className="font-mono text-xs opacity-50">{s.n}</span>
          <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">{s.title}</h3>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-full border hairline transition-all duration-500 ease-out-expo group-hover:rotate-45 group-hover:border-coral group-hover:bg-coral group-hover:text-ink">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <p className="relative mt-3 text-sm leading-relaxed opacity-65">{s.desc}</p>
      <ul className="relative mt-5 flex flex-wrap gap-2">
        {s.tags.map((t) => (
          <li key={t} className="rounded-full border hairline px-3 py-1 text-xs opacity-80">
            {t}
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" data-tone="light" data-scene="services" className="relative px-[5vw] py-[16vh]">
      <div className="mb-14 grid gap-8 md:mb-20 md:grid-cols-12 md:items-end">
        <div className="md:col-span-8">
          <span className="mb-6 block font-mono text-xs uppercase tracking-[0.2em] opacity-60">How it works</span>
          <SplitText
            as="h2"
            type="chars"
            text={["How it", "works."]}
            className="display text-[clamp(2.6rem,7.4vw,8rem)]"
          />
        </div>
        <FadeIn className="md:col-span-4">
          <p className="max-w-sm leading-relaxed opacity-70">
            From idea to a live, tradable token in a few minutes. Your wallet signs every step —
            Kindle never holds your keys or your tokens.
          </p>
        </FadeIn>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {howItWorks.map((s, i) => (
          <StepCard key={s.title} s={s} i={i} />
        ))}
      </div>
    </section>
  );
}
