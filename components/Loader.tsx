"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";


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
      tl.from(".ld-flame", { scale: 0.6, opacity: 0, duration: 1, ease: "expo.out" }, 0)
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
        .to(".ld-flame", { scale: 1.15, opacity: 0, duration: 0.5, ease: "expo.in" }, ">-0.05")
        .add(onDone, ">-0.25")
        .to(root.current, { clipPath: "inset(0% 0% 100% 0%)", duration: 1.1, ease: "expo.inOut" }, "<");
    },
    { scope: root },
  );

  if (gone) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col justify-between bg-black px-[5vw] py-8 text-white"
      style={{ clipPath: "inset(0% 0% 0% 0%)" }}
      role="status"
      aria-label="Loading"
    >
      <div />
      <div className="relative flex justify-center">
        <svg viewBox="0 0 100 100" className="ld-flame kindle-glow size-[clamp(7rem,28vw,13rem)]" aria-hidden="true">
          <path d="M52 4C58 26 80 36 80 62c0 19-14 32-30 32S20 81 20 62c0-14 8-22 14-28 2 10 8 14 12 14C42 30 44 16 52 4Z" fill="#ccff00" />
          <path d="M50 92c-9 0-15-7-15-15 0-9 8-13 11-20 4 6 4 10 3 14 5-1 9-6 10-11 4 5 6 9 6 17 0 8-6 15-15 15Z" fill="#000" />
        </svg>
      </div>
      <div className="relative">
        <div className="mb-3 flex justify-end">
          <span ref={num} className="font-mono text-sm tabular-nums text-[#ccff00]/80">
            000
          </span>
        </div>
        <div className="h-px w-full bg-white/10">
          <div className="ld-bar h-full origin-left scale-x-0 bg-[#ccff00] shadow-[0_0_12px_#ccff00]" />
        </div>
      </div>
    </div>
  );
}
