"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { TextScanner } from "@/components/ui/animated-text-10";

const WORD = "Kindle";

export function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const [gone, setGone] = useState(false);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let seen = false;
      try {
        seen = sessionStorage.getItem("kindle:seen") === "1";
        sessionStorage.setItem("kindle:seen", "1");
      } catch {}
      const dur = reduce ? 0.2 : seen ? 0.9 : 2.1;
      const counter = { v: 0 };

      const tl = gsap.timeline({ onComplete: () => setGone(true) });
      tl.from(".ld-char", { yPercent: 115, stagger: 0.06, duration: 1, ease: "expo.out" }, 0)
        .to(
          counter,
          {
            v: 100,
            duration: dur,
            ease: "power2.inOut",
            onUpdate: () => {
              if (num.current) num.current.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          0,
        )
        .to(".ld-bar", { scaleX: 1, duration: dur, ease: "power2.inOut" }, 0)
        .to(".ld-char", { yPercent: -115, stagger: 0.035, duration: 0.6, ease: "expo.in" }, ">-0.05")
        .add(onDone, ">-0.25")
        .to(root.current, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.1, ease: "expo.inOut" }, "<");
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-[#0b0b0b] px-[5vw] py-8 text-white"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
      role="status"
      aria-label="Loading"
    >
      <div className="aura" />
      <div className="relative flex justify-between text-xs uppercase tracking-[0.2em] text-paper/60">
        <span>Token launchpad on Robinhood Chain</span>
        <TextScanner text="LIGHTING UP" duration={1.6} inkColor="#ffffff" accentColor="var(--accent)" className="font-normal tracking-[0.2em]" />
      </div>
      <div className="relative flex justify-center overflow-hidden">
        {WORD.split("").map((c, i) => (
          <span key={i} className="ld-char display inline-block text-[clamp(4rem,19vw,18rem)]">
            {c}
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="mb-4 flex items-end justify-between">
          <span className="font-mono text-xs text-paper/60">Launch · Trade · Earn</span>
          <span ref={num} className="display text-[clamp(2.5rem,6vw,5rem)] tabular-nums">
            000
          </span>
        </div>
        <div className="h-px w-full bg-paper/15">
          <div className="ld-bar h-full origin-left scale-x-0 bg-gradient-to-r from-coral via-mint to-paper" />
        </div>
      </div>
    </div>
  );
}
