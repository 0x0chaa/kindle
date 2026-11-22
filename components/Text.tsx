"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { motion } from "motion/react";
import { useApp } from "./Providers";
import { cn, EASE_EXPO } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* SplitText — masked, staggered kinetic reveal by word or character   */
/* ------------------------------------------------------------------ */
type SplitProps = {
  text: string | string[];
  as?: ElementType;
  className?: string;
  lineClassName?: (string | undefined)[];
  /** index of a line rendered as a single chrome-gradient word block */
  chromeLine?: number;
  type?: "chars" | "words";
  trigger?: "scroll" | "ready" | "now";
  delay?: number;
};

export function SplitText({
  text,
  as: Tag = "div",
  className,
  lineClassName = [],
  chromeLine,
  type = "words",
  trigger = "scroll",
  delay = 0,
}: SplitProps) {
  const ref = useRef<HTMLElement>(null);
  const { ready, reduced } = useApp();
  const lines = Array.isArray(text) ? text : [text];

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      const targets = ref.current.querySelectorAll(".st");
      if (trigger === "ready" && !ready) {
        gsap.set(targets, { yPercent: 118 });
        return;
      }
      gsap.fromTo(
        targets,
        { yPercent: 118, rotate: type === "chars" ? 7 : 4 },
        {
          yPercent: 0,
          rotate: 0,
          duration: 1.25,
          ease: "expo.out",
          stagger: type === "chars" ? 0.032 : 0.07,
          delay,
          scrollTrigger:
            trigger === "scroll" ? { trigger: ref.current, start: "top 88%", once: true } : undefined,
        },
      );
    },
    { scope: ref, dependencies: [ready, reduced], revertOnUpdate: true },
  );

  return (
    <Tag ref={ref} className={className} aria-label={lines.join(" ")}>
      {lines.map((line, li) => {
        const words = line.split(" ");
        return (
          <span key={li} aria-hidden className={cn("block", lineClassName[li])}>
            {words.map((word, wi) => (
              <span key={wi}>
                <span className="-mb-[0.08em] inline-block overflow-hidden pb-[0.08em] align-top">
                  {type === "chars" && li !== chromeLine ? (
                    [...word].map((ch, ci) => (
                      <span key={ci} className="st inline-block origin-bottom-left will-change-transform">
                        {ch}
                      </span>
                    ))
                  ) : (
                    <span
                      className={cn(
                        "st inline-block origin-bottom-left will-change-transform",
                        li === chromeLine && "text-chrome pr-[0.04em]",
                      )}
                    >
                      {word}
                    </span>
                  )}
                </span>
                {wi < words.length - 1 && " "}
              </span>
            ))}
          </span>
        );
      })}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* ScrubText — words brighten as you scroll through the paragraph      */
/* ------------------------------------------------------------------ */
export function ScrubText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { reduced } = useApp();

  useGSAP(
    () => {
      if (reduced) return;
      gsap.fromTo(
        ".sw",
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top 80%", end: "bottom 45%", scrub: true },
        },
      );
    },
    { scope: ref, dependencies: [reduced] },
  );

  return (
    <p ref={ref} className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="sw">
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* FadeIn — simple Framer Motion entrance                              */
/* ------------------------------------------------------------------ */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 1, delay, ease: EASE_EXPO }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee — infinite strip that speeds up / reverses with scroll      */
/* ------------------------------------------------------------------ */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduced } = useApp();

  useGSAP(
    () => {
      if (reduced) return;
      const loop = gsap.to(".mq-track", { xPercent: -50, duration: 32, ease: "none", repeat: -1 });
      let dir = 1;
      const st = gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const v = self.getVelocity();
            dir = self.direction;
            gsap.to(loop, {
              timeScale: dir * (1 + Math.min(Math.abs(v) / 400, 5)),
              duration: 0.25,
              overwrite: true,
              onComplete: () => {
                gsap.to(loop, { timeScale: dir, duration: 1.2, ease: "power2.out" });
              },
            });
          },
        },
      });
      return () => st.kill();
    },
    { scope: ref, dependencies: [reduced] },
  );

  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className={cn("display px-[3vw]", i % 2 ? "text-outline" : "")}>{t}</span>
          <span className="text-chrome text-[0.5em]">✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div ref={ref} className={cn("overflow-hidden whitespace-nowrap", className)} aria-hidden>
      <div className="mq-track flex w-max">
        {row}
        {row}
      </div>
    </div>
  );
}
